import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { MemoryStorage, CascadeSync, MarkdownHandler, Consolidator, classifyMemory, LLMRunner, EmbeddingClient, VectorStore, loadConfig } from '@mymore/core';
import type { MyMoreConfig } from '@mymore/core';
import { v4 as uuid } from 'uuid';
import { startNotifyServer } from './notify-server.js';
import { PipelineManager } from './pipeline-manager.js';
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

// L0 → L1 调度器（Task 5）：hook 传感器（Task 2）通过 HTTP 投递真实 sessionKey，
// notifyTurn() 按 阈值/warm-up 翻倍/flush 决定何时触发 L1 提取（Plan 3）。
// onL1Ready 不再只 log：转发 notify 的 sessionKey 并驱动 per-session L1Runner 跑
// 真实 L1 提取/去重/双写（Plan 2 I3 接缝 —— 用 notify body 的 sessionKey，非硬编码）。
const pipelineManager = new PipelineManager({
  baseDir: rootDir,
  sessionKey: 'default',
  cfg: pipelineCfg,
  onL1Ready: (_messages, sessionKey) => {
    const key = sessionKey || 'default';
    getL1Runner(key)
      .run()
      .then((r) => console.error(`[pipeline] L1 ready: session=${key} extracted=${r.extracted} stored=${r.stored}`))
      .catch((err) => console.error(`[pipeline] L1 run failed: ${err instanceof Error ? err.message : String(err)}`));
  },
});

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
