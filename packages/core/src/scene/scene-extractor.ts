/**
 * L2 Scene Extractor：单次 LLM 调用把本批 L1 记忆碎片整合进 `scene_blocks/*.md` 叙事文档。
 *
 * 管线（对齐权威蓝图 §4.2 / §4.4 的工程侧职责）：
 * 1. 组装 prompt：现有场景清单（path/summary/heat/body）+ 新 L1 记录 → LLM 单次调用
 * 2. parseSceneDecision：剥代码块 → 括号平衡抽第一个 {...} → sanitize 控制字符 →
 *    JSON.parse 失败 repair 重试一次 → 逐字段校验补默认（容错风格同 L1）
 * 3. 应用动作：
 *    - update：写 target_path 新内容 + 保留 created，更新 updated/summary/heat（old+1 或 LLM heat）
 *    - create：写新文件（sanitize scene_name 后保证 .md 后缀），heat=1（LLM 正常给 1）
 *    - merge：合并内容写 target_path（heat sum+1），deleted_paths 文件写 [DELETED] 软删除标记
 * 4. 动作后调 syncSceneIndex(scenesDir) 重建 scene_index.json（LLM 不可见，工程侧维护）
 * 5. 返回 L2Result（personaUpdateRequested 来自 request_persona_update）
 *
 * 失败处理：LLM 抛错 → 抛错（调用方决定降级）；解析失败/动作非法 → 返回默认 update 空结果。
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LLMRunner } from '../llm.js';
import type { L1Record } from '../record/l1-writer.js';
import {
  parseSceneFile,
  serializeSceneFile,
  sanitizeSceneName,
  syncSceneIndex,
} from './scene-file.js';
import type { SceneFile, SceneIndexEntry } from './scene-file.js';
import { buildSceneSystemPrompt } from '../prompts/scene-extraction.js';

// ============================
// Types
// ============================

export type L2Action = 'update' | 'merge' | 'create';

export interface L2Result {
  action: L2Action;
  targetPath?: string;
  content: string;
  newSceneName?: string;
  deletedPaths?: string[];
  personaUpdateRequested: boolean;
  summary: string;
  heat: number;
}

export interface L2ExtractParams {
  newRecords: L1Record[];
  existingScenes: SceneFile[];
  lastSceneIndex: SceneIndexEntry[];
}

export interface SceneExtractorOptions {
  llm: LLMRunner;
  scenesDir: string;
  team?: string;
  agent?: string;
  /** 场景文件数量上限（默认 50，0 表示不限制） */
  maxScenes?: number;
}

interface SceneDecision {
  action: string;
  target_path?: string;
  content?: string;
  scene_name?: string;
  deleted_paths?: string[];
  request_persona_update?: boolean;
  summary?: string;
  heat?: number;
}

// ============================
// Extractor
// ============================

const DEFAULT_MAX_SCENES = 50;

export class SceneExtractor {
  private readonly llm: LLMRunner;
  private readonly scenesDir: string;
  private readonly team?: string;
  private readonly agent?: string;
  private readonly maxScenes: number;

  constructor(opts: SceneExtractorOptions) {
    this.llm = opts.llm;
    this.scenesDir = opts.scenesDir;
    this.team = opts.team;
    this.agent = opts.agent;
    this.maxScenes = opts.maxScenes ?? DEFAULT_MAX_SCENES;
  }

  /**
   * 运行 L2 提取管线：组 prompt → LLM 单次调用 → 解析 JSON → 应用动作 → 重建索引。
   */
  async extractL2(params: L2ExtractParams): Promise<L2Result> {
    const { newRecords, existingScenes, lastSceneIndex } = params;

    const prompt = this.buildPrompt(newRecords, existingScenes, lastSceneIndex);
    const systemPrompt = buildSceneSystemPrompt(this.maxScenes);
    const raw = await this.llm.run({
      prompt,
      systemPrompt,
      taskId: 'l2-scene-extraction',
      timeoutMs: 180_000,
    });

    const decision = parseSceneDecision(raw);
    return this.applyDecision(decision, existingScenes);
  }

  // ============================
  // Prompt assembly
  // ============================

  private buildPrompt(
    newRecords: L1Record[],
    existingScenes: SceneFile[],
    lastSceneIndex: SceneIndexEntry[],
  ): string {
    const memoriesText =
      newRecords.length > 0
        ? newRecords
            .map((r) => {
              const parts = [
                `[id] ${r.id}`,
                `[type] ${r.type}`,
                `[priority] ${r.priority}`,
                `[created_at] ${r.created_at}`,
                `[content] ${r.content}`,
              ];
              if (r.scene_name) parts.push(`[scene_name] ${r.scene_name}`);
              return parts.join('\n');
            })
            .join('\n\n')
        : '（本批无新增记忆，仅做既有场景的整理/合并）';

    const scenesText =
      existingScenes.length > 0
        ? existingScenes
            .map(
              (s) =>
                `- path: ${s.path}\n  summary: ${s.meta.summary}\n  heat: ${s.meta.heat}\n  updated: ${s.meta.updated}\n  body:\n${this.indent(s.body, 4)}`,
            )
            .join('\n\n')
        : '（当前无已有场景文件）';

    const indexText =
      lastSceneIndex.length > 0
        ? lastSceneIndex
            .map((e) => `- path: ${e.path} | summary: ${e.summary} | heat: ${e.heat} | updated: ${e.updated}`)
            .join('\n')
        : '（暂无索引快照）';

    return `**输出语言**：\`content\`/\`scene_name\`/\`summary\` 使用下方 New Memories List 中记忆的主导语言；JSON 字段名保持英文。

### 1️⃣ New Memories List
${memoriesText}

### 2️⃣ Existing Scene Blocks Summary（${existingScenes.length} 个场景）
${scenesText}

### 3️⃣ Existing Scene Index（scene_index.json 快照）
${indexText}

请按系统提示词中的策略（UPDATE 首选 > MERGE > CREATE 最后手段）输出 JSON 决策。`;
  }

  private indent(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => (line.length > 0 ? pad + line : line))
      .join('\n');
  }

  // ============================
  // Apply decision
  // ============================

  private async applyDecision(
    decision: SceneDecision,
    existingScenes: SceneFile[],
  ): Promise<L2Result> {
    const action = normalizeAction(decision.action);
    const sceneMap = new Map(existingScenes.map((s) => [s.path, s]));
    const now = new Date().toISOString();
    const deletedPaths: string[] = [];
    let targetPath: string | undefined;
    let newSceneName: string | undefined;
    let content = '';
    let heat = 1;

    if (action === 'update' || action === 'merge') {
      const target = decision.target_path ?? (existingScenes.length > 0 ? existingScenes[0].path : undefined);
      if (!target) {
        throw new Error(`[scene-extractor] ${action} 需要 target_path，但 JSON 未提供且无既有场景可回退`);
      }
      targetPath = target;

      const old = sceneMap.get(target);
      const oldHeat = old ? old.meta.heat : 0;
      const llmHeat = typeof decision.heat === 'number' && Number.isFinite(decision.heat) && decision.heat > 0
        ? Math.floor(decision.heat)
        : 0;

      if (action === 'merge') {
        // 合并：热度 sum(所有相关 block) + 1；deleted_paths 软删除
        const deleted = Array.isArray(decision.deleted_paths) ? decision.deleted_paths.map(String) : [];
        for (const p of deleted) {
          const oldFile = sceneMap.get(p);
          if (oldFile) heat += oldFile.meta.heat;
          this.softDelete(p);
          deletedPaths.push(p);
        }
        heat += oldHeat + 1;
        if (llmHeat > 0) heat = llmHeat;
        const created = old?.meta.created ?? now.slice(0, 10);
        content = normalizeContent(decision.content, created, now, decision.summary ?? '', heat);
      } else {
        // 更新：热度 old + 1（或采用 LLM 校验后的 heat）；保留 created
        heat = llmHeat > 0 ? llmHeat : oldHeat + 1;
        const created = old?.meta.created ?? now.slice(0, 10);
        content = normalizeContent(decision.content, created, now, decision.summary ?? '', heat);
      }

      this.writeScene(targetPath, content);
    } else {
      // create：写新文件（sanitize scene_name 归一，保证 .md 后缀），heat=1。
      // newSceneName 保留 LLM 给出的原始名称（展示用），targetPath 为归一后的文件名。
      const rawName = decision.scene_name && decision.scene_name.trim().length > 0
        ? decision.scene_name
        : `scene-${Date.now()}`;
      let fileName = sanitizeSceneName(rawName);
      if (!fileName.endsWith('.md')) fileName = `${fileName}.md`;
      newSceneName = rawName;
      targetPath = fileName;

      heat = 1;
      content = normalizeContent(
        decision.content,
        now.slice(0, 10),
        now,
        decision.summary ?? '',
        heat,
      );
      this.writeScene(fileName, content);
    }

    // 动作后重建 scene_index.json（工程侧维护，LLM 不可见）
    syncSceneIndex(this.scenesDir);

    return {
      action,
      targetPath,
      content,
      newSceneName,
      deletedPaths: deletedPaths.length > 0 ? deletedPaths : undefined,
      personaUpdateRequested: decision.request_persona_update === true,
      summary: decision.summary ?? '',
      heat,
    };
  }

  private writeScene(fileName: string, content: string): void {
    const sceneBlocksDir = join(this.scenesDir, 'scene_blocks');
    const scanDir = existsSync(sceneBlocksDir) ? sceneBlocksDir : this.scenesDir;
    mkdirSync(scanDir, { recursive: true });
    writeFileSync(join(scanDir, fileName), content, 'utf8');
  }

  /** 软删除：把文件内容覆写为 [DELETED] 标记（对齐蓝图 §4.2 / 参考实现：空字符串会被拒绝）。 */
  private softDelete(fileName: string): void {
    const sceneBlocksDir = join(this.scenesDir, 'scene_blocks');
    const scanDir = existsSync(sceneBlocksDir) ? sceneBlocksDir : this.scenesDir;
    const full = join(scanDir, fileName);
    if (existsSync(full)) {
      writeFileSync(full, '[DELETED]', 'utf8');
    }
  }
}

// ============================
// Helpers
// ============================

/** 动作归一：非法动作视为 update（工程侧保守默认）。 */
function normalizeAction(raw: string): L2Action {
  const a = String(raw ?? '').trim().toLowerCase();
  if (a === 'merge') return 'merge';
  if (a === 'create') return 'create';
  return 'update';
}

/**
 * 规范化场景内容：始终以 META 块为前缀（created/updated/summary/heat），
 * 再拼接正文。若 LLM 输出的 content 已含 META 块，则剥离后重新组装，
 * 保证 META 字段（尤其 created 保留、updated=当前时间、heat=工程侧计算值）正确。
 */
function normalizeContent(rawContent: string | undefined, created: string, updated: string, summary: string, heat: number): string {
  let body = typeof rawContent === 'string' ? rawContent : '';
  if (body.trim() === '') body = '[空白场景]';

  // 剥掉 LLM 可能输出的 META 块（参考 parseSceneFile 的正则）
  const metaRe = /-----META-START-----\n[\s\S]*?\n-----META-END-----\n?\n?/;
  body = body.replace(metaRe, '').replace(/^\n+/, '');

  const scene: SceneFile = {
    path: '',
    meta: { created, updated, summary, heat },
    body,
  };
  return serializeSceneFile(scene);
}

/**
 * 把 LLM 输出的 JSON 响应解析为 SceneDecision。
 * 容错链（风格同 L1 parseExtractionResult）：
 * 剥代码块 → 括号平衡抽第一个 {...} → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 → 逐字段校验。
 */
export function parseSceneDecision(raw: string): SceneDecision {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const objectJson = extractFirstJsonObject(cleaned);
    if (objectJson === null) {
      // 无对象但可能只吐了数组/文本 → 保守返回默认
      return { action: 'update', content: '', request_persona_update: false };
    }

    const sanitized = sanitizeJsonForParse(objectJson);

    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized) as unknown;
    } catch {
      const repaired = repairSceneJson(sanitized);
      parsed = JSON.parse(repaired) as unknown;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { action: 'update', content: '', request_persona_update: false };
    }

    const d = parsed as Record<string, unknown>;
    return {
      action: typeof d.action === 'string' ? d.action : 'update',
      target_path: typeof d.target_path === 'string' ? d.target_path : undefined,
      content: typeof d.content === 'string' ? d.content : '',
      scene_name: typeof d.scene_name === 'string' ? d.scene_name : undefined,
      deleted_paths: Array.isArray(d.deleted_paths) ? d.deleted_paths.map(String) : [],
      request_persona_update: d.request_persona_update === true,
      summary: typeof d.summary === 'string' ? d.summary : '',
      heat: typeof d.heat === 'number' && Number.isFinite(d.heat) ? d.heat : undefined,
    };
  } catch {
    return { action: 'update', content: '', request_persona_update: false };
  }
}

/** 抽取文本中第一个括号平衡的 JSON 对象字面量（正确处理字符串内的 { } 与嵌套对象）。 */
function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F），保留 \t \n \r。 */
function sanitizeJsonForParse(raw: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (ch === '\\') {
        out += ch + (raw[i + 1] ?? '');
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        switch (ch) {
          case '\n':
            out += '\\n';
            break;
          case '\r':
            out += '\\r';
            break;
          case '\t':
            out += '\\t';
            break;
          case '\b':
            out += '\\b';
            break;
          case '\f':
            out += '\\f';
            break;
          default:
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        }
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/** repair：去尾逗号（`,}` / `,]`）。 */
function repairSceneJson(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}
