import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdirSync, readFileSync, existsSync, readdirSync } from 'fs';
import { MemoryStorage, CascadeSync, MarkdownHandler, Consolidator, classifyMemory, LLMRunner, EmbeddingClient, VectorStore, loadConfig, SceneExtractor, PersonaGenerator, readL1Records, syncSceneIndex, parseSceneFile, serializeSceneFile } from '@mymore/core';
import type { MyMoreConfig, L1Record, SceneFile, SceneIndexEntry } from '@mymore/core';
import { v4 as uuid } from 'uuid';
import { startNotifyServer } from './notify-server.js';
import { PipelineManager, PersonaTrigger } from './pipeline-manager.js';
import { L1Runner } from './l1-runner.js';
import { loadPipelineConfig } from './pipeline-config.js';

const rootDir = process.env.MYMORE_ROOT || join(homedir(), '.mymore');
const memoryDir = join(rootDir, 'memory');
const dbPath = join(rootDir, '.index', 'memory.db');

mkdirSync(join(rootDir, '.index'), { recursive: true });

// 管线配置（pipeline.everyNConversations / l1IdleTimeoutSeconds）。
// loadPipelineConfig 对缺失/损坏/违规的 config.json 回退 core 默认值，
// 启动不因配置而死（final review I1）。
const pipelineCfg = loadPipelineConfig(rootDir);

// L1 提取所需的真实依赖：llm/embed 走 config。config.json 缺失/损坏时回退空配置——
// LLM 调用在运行时失败由 extractL1Memories 兜底（success:false 全 0），启动不因配置而死。
const l1Config = (() => {
  try {
    return loadConfig(rootDir);
  } catch (err) {
    console.error(`[config] config.json 缺失/损坏，L1 依赖回退空配置:`, (err as Error).message);
    return { llm: { baseUrl: '', apiKey: '', model: '' } } as MyMoreConfig;
  }
})();

// 向量维度：不再硬编码 1536（Plan 3 硬前提 2 —— 真实非 1536 维 embedding 端点会因
// VectorStore 建表维度错位而运行时失败）。改为从 config 的 llm.embeddingModel 推导；
// 无 config 时先探一个默认维度，首次真实 embed 调用后强校验，mismatch 立即响亮报错
// （VectorStore 建表后维度不可变，错误必须在写库前暴露，绝不静默降级）。
//
// 模型名 → 维度 推导。OpenAI text-embedding-3-large 为 3072 维，其余 text-embedding-3-* 为 1536。
const EMBEDDING_MODEL_DIMS: Record<string, number> = {
  'text-embedding-3-large': 3072,
};

/** 无法从 config 推导时的默认维度（仅作建表用，首次 embed 后强校验）。 */
const FALLBACK_DIMS = 1536;

/**
 * 从 config 推导向量维度（Plan 3 硬前提 2）：
 * - llm.embeddingModel（或回退 llm.model）命中已知模型 → 直接返回其维度；
 * - 命中已知模型族前缀（nomic-embed / mxbai-embed / bge-m3 等非 1536 端点）→ 返回族维度；
 * - 否则返回 FALLBACK_DIMS 暂定，首次真实 embed 后强校验（mismatch → throw）。
 */
function resolveEmbeddingDims(cfg: MyMoreConfig): number {
  const model = (cfg.llm.embeddingModel ?? cfg.llm.model).trim();
  if (model) {
    const exact = EMBEDDING_MODEL_DIMS[model];
    if (exact !== undefined) {
      console.error(`[vector] embedding 维度由 config 推导：model=${model} dims=${exact}`);
      return exact;
    }
    const byFamily = matchKnownModelFamilyDims(model);
    if (byFamily !== null) {
      console.error(`[vector] embedding 维度由 config 推导：model=${model} dims=${byFamily}`);
      return byFamily;
    }
    console.error(
      `[vector] 无法从 embeddingModel 推断维度（model=${model}），先探默认 ${FALLBACK_DIMS}，首次 embed 后强校验`,
    );
    return FALLBACK_DIMS;
  }
  console.error(`[vector] 无 embedding 配置，先探默认 ${FALLBACK_DIMS}，首次 embed 后强校验`);
  return FALLBACK_DIMS;
}

/**
 * 已知 embedding 模型族维度推导（config 有模型名、但不在精确表中时按族前缀匹配）：
 * - OpenAI text-embedding-3-* 中，仅 large 是 3072，其余（small/ada 等）为 1536；
 * - 其余已知端点（如 ollama nomic-embed-text 768 / mxbai-embed-large 1024）按前缀识别。
 * 返回 null 表示无法推导（走首次 embed 探测 + 强校验）。
 */
function matchKnownModelFamilyDims(model: string): number | null {
  const name = model.trim().toLowerCase();
  if (name.includes('text-embedding-3')) return name.includes('large') ? 3072 : 1536;
  if (name.includes('nomic-embed')) return 768;
  if (name.includes('mxbai-embed')) return 1024;
  if (name.includes('bge-m3')) return 1024;
  return null;
}

// 由 config 推导的向量维度（Plan 3 硬前提 2）：VectorStore 建表用，建表后不可变。
const embeddingDims = resolveEmbeddingDims(l1Config);

const storage = new MemoryStorage(dbPath);
const vector = new VectorStore(join(rootDir, '.index', 'vec.db'), embeddingDims);

// 首次真实 embed 后强校验维度（Plan 3 硬前提 2）：VectorStore 建表后维度不可变，
// 实际维度 ≠ 建表维度必须在写库前响亮报错。包一层 embedBatch——L1 去重/双写的所有
// 向量都经它落库，mismatch 时 throw（非静默），错误信息指向 config.llm.embeddingModel。
const embed = new EmbeddingClient(l1Config.llm);
const rawEmbedBatch = embed.embedBatch.bind(embed);
embed.embedBatch = async (texts: string[]): Promise<Float32Array[]> => {
  const vecs = await rawEmbedBatch(texts);
  const model = l1Config.llm.embeddingModel ?? l1Config.llm.model;
  for (const vec of vecs) {
    if (vec.length !== embeddingDims) {
      throw new Error(
        `[vector] embedding 维度不匹配：config 推导建表 ${embeddingDims} 维，` +
          `首次 embed（model=${model || 'unknown'}）实测 ${vec.length} 维。` +
          `VectorStore 建表后维度不可变，请在 config.llm.embeddingModel 配置正确的模型名后重建向量库。`,
      );
    }
  }
  return vecs;
};
const llm = new LLMRunner(l1Config.llm);
const md = new MarkdownHandler(memoryDir);
const cascade = new CascadeSync(storage, md);
const consolidator = new Consolidator(storage, cascade, md);

// L0 → L1 → L2 → L3 调度器（Task 5）：hook 传感器（Task 2）通过 HTTP 投递真实 sessionKey，
// notifyTurn() 按 阈值/warm-up 翻倍/flush 决定何时触发 L1 提取（Plan 3）。
// L1 完成 → advanceL2Timer（只提前不延后）；L2 完成 → armL2MaxInterval + triggerL3；
// 冷 session（>24h 无活跃）停 L2 定时器；L3 全局串行 + pending 去重（spec §4.3）。
//
// onL1Ready 不再只 log：转发 notify 的 sessionKey 并驱动 per-session L1Runner 跑
// 真实 L1 提取/去重/双写（Plan 2 I3 接缝 —— 用 notify body 的 sessionKey，非硬编码）。
//
// L2/L3 配置（config.json pipeline.*，缺失回退 core 默认值）：loadPipelineConfig 已回退
// everyN/l1Idle，L2/L3 字段在 PipelineManager 构造时直接读 l1Config（同源兜底）。
const l2L3Cfg = {
  l2DelayAfterL1Seconds: l1Config.pipeline?.l2DelayAfterL1Seconds ?? 90,
  l2MinIntervalSeconds: l1Config.pipeline?.l2MinIntervalSeconds ?? 900,
  l2MaxIntervalSeconds: l1Config.pipeline?.l2MaxIntervalSeconds ?? 3600,
  triggerEveryN: l1Config.pipeline?.triggerEveryN ?? 10,
};

// L2/L3 落地位置（spec §2.5 数据目录）：scene_blocks/（L2 场景 .md）+ persona.md（L3 画像）。
// SceneExtractor 用 scenesDir=rootDir，其内部扫描 <rootDir>/scene_blocks/（子目录优先，平铺兜底）。
// 预先创建 scene_blocks/，保证 extractL2 始终落在子目录（不污染 rootDir 平铺）。
const scenesRoot = join(rootDir, 'scene_blocks');
mkdirSync(scenesRoot, { recursive: true });
const personaPath = join(rootDir, 'persona.md');

// L2 SceneExtractor + L3 PersonaGenerator（Task 5 接线）：构造注入共享 LLMRunner。
const sceneExtractor = new SceneExtractor({ llm, scenesDir: rootDir, team: undefined, agent: undefined });
const personaGenerator = new PersonaGenerator({ llm, personaPath, dataDir: rootDir, team: undefined, agent: undefined });

// L1 → L2 增量游标：每次 L2 跑完后推进，避免重复消费同一批 L1 记忆。
let lastL2Version = 0;
// L3 P4 阈值游标：自上次 persona 生成以来新增的 L1 记忆数 >= triggerEveryN 才触发。
let lastPersonaVersion = 0;

/** 读取本次 L2/L3 的 L1 增量（afterVersion 游标）。 */
function readL2Increment(): L1Record[] {
  return readL1Records(rootDir, { afterVersion: lastL2Version });
}

/** 读取既有场景文件（scene_blocks/*.md）与索引快照（scene_index.json）。 */
function readExistingScenes(): { scenes: SceneFile[]; index: SceneIndexEntry[] } {
  let files: string[];
  try {
    files = readdirSync(scenesRoot).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }
  const scenes: SceneFile[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(scenesRoot, f), 'utf8');
      const scene = parseSceneFile(raw);
      if (scene) scenes.push({ ...scene, path: f });
    } catch {
      // 单文件损坏跳过，不影响整批
    }
  }
  const index: SceneIndexEntry[] = (() => {
    try {
      return JSON.parse(readFileSync(join(rootDir, 'scene_index.json'), 'utf8')) as SceneIndexEntry[];
    } catch {
      return [];
    }
  })();
  return { scenes, index };
}

/**
 * 跑 L2：读 L1 增量 + 既有场景 → SceneExtractor.extractL2 → 推进游标 + 重建索引。
 * extractL2 解析失败会 throw（参考 §4.2），此处 try/catch 降级：失败不落任何文件、
 * 不推进游标（下次可重试），返回空上下文（不触发 L3 的 P1/P3）。
 */
async function runL2Extraction(): Promise<{ personaUpdateRequested?: boolean; firstScene?: boolean }> {
  try {
    const newRecords = readL2Increment();
    const { scenes, index } = readExistingScenes();
    const beforeCount = scenes.length;
    const result = await sceneExtractor.extractL2({
      newRecords,
      existingScenes: scenes,
      lastSceneIndex: index,
    });
    // 推进 L2 游标到本次读取的最新 version（readL1Records 已按 created_at 降序，取 max）
    const maxVersion = newRecords.reduce((max, r) => (r.version > max ? r.version : max), 0);
    if (maxVersion > lastL2Version) lastL2Version = maxVersion;
    // L2 动作后工程侧重建 scene_index.json（SceneExtractor 内部已调 syncSceneIndex(rootDir)）
    try { syncSceneIndex(rootDir); } catch { /* 索引重建失败不致命 */ }
    console.error(
      `[pipeline] L2 done: action=${result.action} target=${result.targetPath ?? ''} newScene=${result.newSceneName ?? ''} personaUpdate=${result.personaUpdateRequested}`,
    );
    const firstScene = result.action === 'create' && beforeCount === 0;
    return { personaUpdateRequested: result.personaUpdateRequested, firstScene };
  } catch (err) {
    console.error(`[pipeline] L2 failed (降级，不落文件): ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

/**
 * 跑 L3：PersonaTrigger 五级判定命中才调 PersonaGenerator.generatePersona。
 * - P1 request_persona_update（L2 带出）；P2 冷启动（有场景无 persona.md）；
 * - P3 首场景（本批 create 且此前无场景）；P4 阈值（本批 L1 增量 >= triggerEveryN）。
 */
async function runL3Generation(personaUpdateRequested: boolean, firstScene: boolean): Promise<void> {
  const { scenes } = readExistingScenes();
  const personaExists = existsSync(personaPath);
  // P4 阈值：自上次 persona 以来新增的 L1 记忆数（lastPersonaVersion 游标）。
  const memoriesSinceLastPersona = readL1Records(rootDir, { afterVersion: lastPersonaVersion }).length;

  const should = PersonaTrigger.shouldGenerate({
    requestPersonaUpdate: personaUpdateRequested,
    scenesExist: scenes.length > 0,
    personaExists,
    firstScene,
    memoriesSinceLastPersona,
    triggerEveryN: l2L3Cfg.triggerEveryN,
  });
  if (!should) return;

  const mode = personaExists ? 'incremental' : 'first';
  const existingPersona = personaExists ? readFileSync(personaPath, 'utf-8') : undefined;
  const changedScenes = scenes
    .slice()
    .sort((a, b) => (a.meta.updated < b.meta.updated ? 1 : -1))
    .slice(0, 8)
    .map((s) => ({ content: serializeSceneFile(s), updated: s.meta.updated }));

  try {
    const res = await personaGenerator.generatePersona({ mode, existingPersona, changedScenes });
    // 生成成功后推进 P4 游标到当前最新 L1 version（persona 已纳入这些记忆）。
    const latest = readL1Records(rootDir, { limit: 1 })[0];
    if (latest && latest.version > lastPersonaVersion) lastPersonaVersion = latest.version;
    console.error(`[pipeline] L3 done: mode=${mode} success=${res.success} path=${res.personaPath}`);
  } catch (err) {
    console.error(`[pipeline] L3 failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const pipelineManager = new PipelineManager({
  baseDir: rootDir,
  sessionKey: 'default',
  cfg: {
    everyNConversations: pipelineCfg.everyNConversations,
    l1IdleTimeoutSeconds: pipelineCfg.l1IdleTimeoutSeconds,
    ...l2L3Cfg,
  },
  onL1Ready: (_messages, sessionKey) => {
    const key = sessionKey || 'default';
    getL1Runner(key)
      .run()
      .then((r) => console.error(`[pipeline] L1 ready: session=${key} extracted=${r.extracted} stored=${r.stored}`))
      .catch((err) => console.error(`[pipeline] L1 run failed: ${err instanceof Error ? err.message : String(err)}`));
  },
  // L2 定时器触发：读 L1 增量 → SceneExtractor.extractL2（extractL2 解析失败会 throw，
  // 由 PipelineManager 捕获降级，绝不中断调度）。
  onL2TimerFired: async () => runL2Extraction(),
  // L3 触发：PersonaTrigger 五级判定（P1 request / P2 冷启动 / P3 首场景 / P4 阈值）
  // 命中才跑 PersonaGenerator.generatePersona。
  onL3Triggered: async (ctx) => runL3Generation(ctx.personaUpdateRequested, ctx.firstScene),
});

// L2/L3 定时器（spec §4.3）：每 15s 检查一次 L2 目标时刻，到点触发 onL2TimerFired。
// 冷 session（>24h 无活跃）onL2TimerFired 返回 false → 目标清 0，等待下次 L1 活跃。
// unref 保证定时器不阻塞进程退出（SIGTERM flush 已覆盖挂起状态）。
setInterval(() => {
  const target = pipelineManager.getL2TimerTarget();
  if (target > 0 && Date.now() >= target) {
    pipelineManager.onL2TimerFired();
  }
}, 15_000).unref();

// per-session L1Runner：同一进程内可能收到多个 sessionKey 的 notify，每个 session
// 各持一个 runner（独立 lastL1Timestamp 游标），共享同一套 llm/storage/vector/embed。
const l1Runners = new Map<string, L1Runner>();
function getL1Runner(sessionKey: string): L1Runner {
  let runner = l1Runners.get(sessionKey);
  if (!runner) {
    runner = new L1Runner({
      baseDir: rootDir,
      sessionKey,
      llm,
      storage,
      vector,
      embed,
      lastL1Timestamp: 0,
    });
    l1Runners.set(sessionKey, runner);
  }
  return runner;
}

const notifyPort = Number(process.env.MYMORE_NOTIFY_PORT || 3477);
startNotifyServer(notifyPort, (sessionKey) => {
  console.error(`[notify] L0 增量 sessionKey=${sessionKey}`);
  pipelineManager.notifyTurn(sessionKey);
}).catch((err) => {
  console.error(`[notify] 通知端口 ${notifyPort} 启动失败:`, err);
});

// SessionEnd / SIGTERM → flush：pending 计数 > 0 时补触发一次 L1。
async function flushPipeline() {
  await pipelineManager.flush();
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    flushPipeline().finally(() => process.exit(0));
  });
}

// Startup scan
const scan = cascade.scanAndSync();

const server = new McpServer({
  name: 'mymore-mcp',
  version: '1.0.0',
});

server.tool(
  'add_memory',
  {
    content: z.string(),
    owner_id: z.string(),
    track: z.enum(['user', 'agent']).optional().default('user'),
    category: z.enum(['persistent', 'session', 'auto']).optional().default('auto'),
    valid_until: z.string().datetime({ offset: true }).optional(),
    session_id: z.string().optional(),
    group_key: z.string().optional(),
  },
  async (args) => {
    try {
      const category = args.category === 'auto'
        ? classifyMemory(args.content)
        : args.category;

      const now = new Date().toISOString();
      const entry = {
        id: uuid(),
        track: args.track,
        owner_id: args.owner_id,
        category,
        content: args.content,
        created_at: now,
        valid_until: args.valid_until ?? undefined,
        session_id: args.session_id ?? undefined,
        frozen: false,
        access_count: 0,
      };

      let mdPath: string;
      let actualId = entry.id;
      if (args.group_key) {
        // Create new FTS5 entry (individual row per entry for correct timestamps)
        // Append to group Markdown file for human readability
        const mdEntry = { ...entry, group_key: args.group_key };
        const result = cascade.syncOne(mdEntry);
        mdPath = md.appendToGroup(mdEntry);
        actualId = entry.id;
        storage.updateMdPath(actualId, mdPath);
      } else {
        const result = cascade.syncOne(entry);
        mdPath = result.mdPath;
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: actualId, md_path: mdPath, category, group_key: args.group_key ?? null }) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'search_memory',
  {
    query: z.string().optional(),
    owner_id: z.string().optional(),
    track: z.enum(['user', 'agent']).optional(),
    category: z.enum(['persistent', 'session', 'archived']).optional(),
    group_key: z.string().optional(),
    include_expired: z.boolean().optional().default(false),
    limit: z.number().optional().default(20),
  },
  async (args) => {
    try {
      const results = storage.search(args.query, {
        owner_id: args.owner_id,
        track: args.track,
        category: args.category,
        group_key: args.group_key,
        include_expired: args.include_expired,
        limit: args.limit,
      });
      for (const r of results) storage.incrementAccess(r.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'forget_memory',
  {
    id: z.string(),
    superseded_by: z.string().optional(),
  },
  async (args) => {
    try {
      const existing = storage.getById(args.id);
      if (!existing) {
        return { content: [{ type: 'text' as const, text: `记忆 ${args.id} 不存在` }], isError: true };
      }
      if (args.superseded_by) {
        storage.markSuperseded(args.id, args.superseded_by);
      } else {
        storage.updateRow(args.id, { category: 'archived', frozen: 0 } as any);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id, status: 'forgotten' }) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'consolidate',
  {
    owner_id: z.string().optional(),
    days: z.number().optional().default(7),
    dry_run: z.boolean().optional().default(false),
    retention_days: z.number().optional().describe('清理超过此天数的 archived 记录，默认 30'),
  },
  async (args) => {
    try {
      const summary = await consolidator.run(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'reflect_memories',
  {
    group_key: z.string().describe('Project group key to reflect on'),
    owner_id: z.string().optional().default('dante926'),
    limit: z.number().optional().default(20),
  },
  async (args) => {
    try {
      // Read raw session entries for this group, grouped by proximity
      const rawEpisodes = storage.search(null, {
        group_key: args.group_key,
        owner_id: args.owner_id,
        category: 'session',
        limit: args.limit,
      });

      if (rawEpisodes.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ episodes: [], message: 'No raw episodes to reflect on.' }) }] };
      }

      // Group nearby entries into conversational clusters (within 5 min)
      const clusters: { time: string; turns: { role: string; content: string }[] }[] = [];
      let current: { time: string; turns: { role: string; content: string }[] } | null = null;

      for (const ep of rawEpisodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        const t = new Date(ep.created_at).getTime();
        if (!current || t - new Date(current.time).getTime() > 300000) {
          current = { time: ep.created_at, turns: [] };
          clusters.push(current);
        }
        current.turns.push({ role: ep.track === 'agent' ? 'assistant' : 'user', content: ep.content.slice(0, 2000) });
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ clusters, total: rawEpisodes.length }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'deprecate_episodes',
  {
    episode_ids: z.array(z.string()).describe('IDs of raw session entries to mark as deprecated'),
    superseded_by: z.string().describe('ID of the persistent entry that replaces them'),
  },
  async (args) => {
    try {
      for (const id of args.episode_ids) {
        storage.markSuperseded(id, args.superseded_by);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ deprecated: args.episode_ids.length, superseded_by: args.superseded_by }) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'reflect_all',
  {
    group_key: z.string().optional().describe('Optional: limit to a specific project'),
    owner_id: z.string().optional().default('dante926'),
    dry_run: z.boolean().optional().default(false),
  },
  async (args) => {
    try {
      const filters: any = { owner_id: args.owner_id, category: 'session', limit: 200 };
      if (args.group_key) filters.group_key = args.group_key;

      const all = storage.search(null, filters);
      if (all.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ clusters: [], total: 0, message: 'No raw episodes to reflect on.' }) }] };
      }

      const byGroup: Record<string, typeof all> = {};
      for (const ep of all) {
        const gk = ep.group_key || 'default';
        if (!byGroup[gk]) byGroup[gk] = [];
        byGroup[gk].push(ep);
      }

      const clusters: { group_key: string; time: string; turns: { role: string; content: string }[]; ids: string[] }[] = [];
      for (const [gk, eps] of Object.entries(byGroup)) {
        const sorted = eps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        let current: { group_key: string; time: string; turns: { role: string; content: string }[]; ids: string[] } | null = null;
        for (const ep of sorted) {
          const t = new Date(ep.created_at).getTime();
          if (!current || t - new Date(current.time).getTime() > 300000) {
            current = { group_key: gk, time: ep.created_at, turns: [], ids: [] };
            clusters.push(current);
          }
          current.turns.push({ role: ep.track === 'agent' ? 'assistant' : 'user', content: ep.content.slice(0, 2000) });
          current.ids.push(ep.id);
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ clusters, total: all.length, dry_run: args.dry_run }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
