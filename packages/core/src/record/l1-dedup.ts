/**
 * L1 去重（批量模式）：候选召回（向量/FTS 三级降级）+ LLM 批量判定（store/skip/update/merge）。
 *
 * 依据权威蓝图 §3.5：
 * - 候选召回三级降级：① vector + embed 且 storage 有 L1 → Tier 1 向量（多取 topK+len 抵消自匹配）；
 *   ② storage 有 FTS 数据 → Tier 2 FTS 关键词召回；③ 无召回能力 → storeAll 跳过去重。
 * - 有候选 → formatBatchConflictPrompt + LLM（CONFLICT_DETECTION_SYSTEM_PROMPT）→ 解析判定
 *   （复用 Task 2 的容错思路：剥代码块/抽数组/逐字段补默认）。
 * - applyDecisions：skip → 不落；store → DualWriter.storeL1；
 *   update/merge → vector.remove(target) 每个 target_id + DualWriter.storeL1(merged_content/type, version=max+1)。
 * - 隔离：filter 带 team/agent，绝不跨租户。
 */

import type { LLMRunner } from '../llm.js';
import type { MemoryStorage } from '../storage.js';
import type { VectorStore, EmbeddingClient } from '../vector.js';
import type { L1Record, L1RecordType } from './l1-writer.js';
import { DualWriter } from './dual-writer.js';
import {
  CONFLICT_DETECTION_SYSTEM_PROMPT,
  formatBatchConflictPrompt,
} from '../prompts/l1-dedup.js';
import type { CandidateMatch } from '../prompts/l1-dedup.js';

// ============================
// Types
// ============================

export type DedupAction = 'store' | 'skip' | 'update' | 'merge';

export interface DedupDecision {
  record_id: string;
  action: DedupAction;
  target_ids: string[];
  merged_content?: string;
  merged_type?: string;
  merged_priority?: number;
  merged_timestamps?: string[];
}

export interface BatchDedupParams {
  memories: Array<L1Record & { record_id: string }>;
  llm: LLMRunner;
  vector?: VectorStore;
  embed?: EmbeddingClient;
  storage: MemoryStorage;
  conflictRecallTopK?: number;
  team?: string;
  agent?: string;
}

export interface ApplyDecisionsParams {
  memories: Array<L1Record & { record_id: string }>;
  decisions: DedupDecision[];
  storage: MemoryStorage;
  vector: VectorStore;
  embed: EmbeddingClient;
  baseDir: string;
  team?: string;
  agent?: string;
}

// ============================
// Core: batchDedup
// ============================

const VALID_TYPES: L1RecordType[] = [
  'persona',
  'episodic',
  'instruction',
  'work_fact',
  'work_task',
  'work_method',
  'work_artifact',
];

/**
 * 批量去重：候选召回（三级降级）+ LLM 批量判定，返回每条新记忆的决策。
 *
 * 候选召回：
 * 1. Tier 1 向量：vector + embed 可用且 storage 有 L1 记录 → embed 每条新记忆 content，
 *    vector.search topK（多取 topK+len 抵消自匹配），过滤本批 + 按 score 阈值 → 候选。
 * 2. Tier 2 FTS：storage 有 FTS 数据 → storage.search(memory.content, {limit:10}) 过滤本批 → 候选。
 * 3. 无召回能力 → storeAll() 跳过去重。
 *
 * 隔离：team/agent 过滤在候选召回前完成（存储层查询自带 team/agent 过滤），绝不跨租户。
 */
export async function batchDedup(params: BatchDedupParams): Promise<DedupDecision[]> {
  const {
    memories,
    llm,
    vector,
    embed,
    storage,
    conflictRecallTopK = 5,
    team,
    agent,
  } = params;

  if (memories.length === 0) return [];

  const storeAll = (): DedupDecision[] =>
    memories.map((m) => ({ record_id: m.record_id, action: 'store' as const, target_ids: [] }));

  // 召回能力检测：
  // - Tier 1 需要 vector + embed + storage 里有已落库的 L1（meta 索引存在）
  // - Tier 2 需要 storage 里有 FTS 数据（meta 索引存在）
  // - 都没有 → 无召回能力 → storeAll
  const storageHasL1 = storageHasRecords(storage);
  const hasVectorTier = Boolean(vector && embed) && storageHasL1;
  const hasFtsTier = storageHasL1;

  if (!hasVectorTier && !hasFtsTier) {
    // 无召回能力：跳过去重，全部 store
    return storeAll();
  }

  // Phase 1: 候选召回
  let matches: CandidateMatch[];
  try {
    if (hasVectorTier) {
      matches = await findCandidatesByVector(memories, vector!, embed!, storage, conflictRecallTopK, { team, agent });
    } else {
      matches = await findCandidatesByFts(memories, storage, { team, agent });
    }
  } catch (err) {
    console.warn(
      `[l1-dedup] candidate recall failed, all store: ${err instanceof Error ? err.message : String(err)}`,
    );
    return storeAll();
  }

  // Phase 2: LLM 批量判定
  // 说明：召回能力存在即调用 LLM（即使某条/所有记忆无候选），
  // 由 LLM 决定 store（prompt 明确"候选列表为空 → 直接 store"）。
  // 只有"无召回能力"才走 storeAll 跳过去重。
  try {
    const raw = await llm.run({
      prompt: formatBatchConflictPrompt(matches),
      systemPrompt: CONFLICT_DETECTION_SYSTEM_PROMPT,
      taskId: 'l1-conflict-detection',
      timeoutMs: 180_000,
    });
    return parseDedupDecisions(raw, memories);
  } catch (err) {
    // LLM 失败 → 全部 store（不丢记忆）
    console.warn(
      `[l1-dedup] LLM conflict detection failed, all store: ${err instanceof Error ? err.message : String(err)}`,
    );
    return storeAll();
  }
}

// ============================
// Candidate recall
// ============================

/** storage 是否已有 L1 记录（meta 表非空）。无 query 的 search() 列出全部（默认 limit 20），足够判空。 */
function storageHasRecords(storage: MemoryStorage): boolean {
  try {
    return storage.search(undefined, { limit: 20 }).length > 0;
  } catch {
    return false;
  }
}

interface Isolation {
  team?: string;
  agent?: string;
}

/**
 * Tier 1 向量召回：批量 embed 新记忆 → vector.search topK（多取 topK+len 抵消自匹配）→
 * 过滤本批 → 从 meta 索引取回候选详情（team/agent 隔离 + score 阈值）。
 */
async function findCandidatesByVector(
  memories: Array<L1Record & { record_id: string }>,
  vector: VectorStore,
  embed: EmbeddingClient,
  storage: MemoryStorage,
  topK: number,
  isolation: Isolation,
): Promise<CandidateMatch[]> {
  const newRecordIds = new Set(memories.map((m) => m.record_id));

  // 批量 embed 所有新记忆
  const embeddings = await embed.embedBatch(memories.map((m) => m.content));

  const matches: CandidateMatch[] = [];
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const queryVec = embeddings[i];

    // 多取 topK + len 抵消自匹配（本批新记忆可能已入向量库）
    const searchResults = vector.search(queryVec, topK + memories.length);

    const candidates: L1Record[] = [];
    for (const hit of searchResults) {
      if (candidates.length >= topK) break;
      if (newRecordIds.has(hit.record_id)) continue; // 过滤本批（自匹配）
      if ((hit.score ?? 0) <= 0.3) continue; // 相似度阈值：正交/弱相关不算候选
      const row = storage.getById(hit.record_id);
      if (!row) continue;
      // 隔离：绝不跨租户
      if (isolation.team !== undefined && row.team !== isolation.team) continue;
      if (isolation.agent !== undefined && row.agent !== isolation.agent) continue;
      candidates.push(rowToL1Record(row, storage));
    }

    matches.push({ newMemory: mem, candidates });
  }

  return matches;
}

/**
 * Tier 2 FTS 召回：storage.search(memory.content, {limit:10}) → 过滤本批 → 取前 topK。
 * 用 memory.content 作为隔离条件下的搜索词（storage.search 的 FTS 命中会自动排除 team/agent 不符的记录）。
 */
async function findCandidatesByFts(
  memories: Array<L1Record & { record_id: string }>,
  storage: MemoryStorage,
  isolation: Isolation,
): Promise<CandidateMatch[]> {
  const newRecordIds = new Set(memories.map((m) => m.record_id));
  const matches: CandidateMatch[] = [];

  for (const mem of memories) {
    const searchTerm = makeFtsSearchTerm(mem.content, isolation);
    const results = storage.search(searchTerm, { limit: 10 });
    const candidates: L1Record[] = [];
    for (const r of results) {
      if (candidates.length >= 5) break;
      if (newRecordIds.has(r.id)) continue;
      const row = storage.getById(r.id);
      if (!row) continue;
      // 兜底隔离：FTS 查询结果理论上已按 team/agent 过滤，这里再校验一次（防御性）
      if (isolation.team !== undefined && row.team !== isolation.team) continue;
      if (isolation.agent !== undefined && row.agent !== isolation.agent) continue;
      candidates.push(rowToL1Record(row, storage));
    }
    matches.push({ newMemory: mem, candidates });
  }

  return matches;
}

/**
 * 构造 FTS 搜索词：
 * - team/agent 隔离时用不存在的占位词（FTS 命中 0 条）——storage.search 只按 owner_id/track/category
 *   过滤，没有 team/agent 过滤能力，直接以 content 搜索必会跨租户命中；占位词让候选为空，LLM 按
 *   "无候选 → store" 处理，绝不跨租户。
 * - 无隔离时用记忆内容本身（FTS 关键词召回）。
 */
function makeFtsSearchTerm(content: string, isolation: Isolation): string | undefined {
  if (isolation.team !== undefined || isolation.agent !== undefined) {
    return 'mymore-no-cross-tenant';
  }
  return content;
}

// ============================
// Result parsing（容错，复用 Task 2 思路）
// ============================

/**
 * 解析 LLM 批量判定 JSON。容错链：
 * 剥代码块 → 括号平衡抽首数组 → sanitize 控制字符 → JSON.parse（失败 repair 一次）→
 * 逐字段补默认（action→store，target_ids→[]，merged_* 类型校验）→ 缺失记忆补 store。
 */
export function parseDedupDecisions(
  raw: string,
  memories: Array<L1Record & { record_id: string }>,
): DedupDecision[] {
  try {
    // 1. 剥 markdown 代码块
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // 2. 括号平衡抽取第一个 JSON 数组
    const arrayJson = extractFirstJsonArray(cleaned);
    if (arrayJson === null) return storeAllFallback(memories);

    // 3. sanitize 控制字符
    const sanitized = sanitizeJsonForParse(arrayJson);

    // 4. JSON.parse，失败 repair 一次
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized) as unknown;
    } catch {
      const repaired = repairDedupJson(sanitized);
      parsed = JSON.parse(repaired) as unknown;
    }

    if (!Array.isArray(parsed)) return storeAllFallback(memories);

    // 5. 逐条结构化校验 + 补默认
    const validActions: DedupAction[] = ['store', 'update', 'merge', 'skip'];
    const decisions: DedupDecision[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const d = item as Record<string, unknown>;

      const recordId = String(d.record_id ?? '');
      // 空/缺失 record_id → LLM 幻觉，跳过该条
      if (!recordId) continue;

      const rawAction = String(d.action ?? 'store');
      const action: DedupAction = (validActions as string[]).includes(rawAction)
        ? (rawAction as DedupAction)
        : 'store';

      decisions.push({
        record_id: recordId,
        action,
        target_ids: Array.isArray(d.target_ids) ? d.target_ids.map(String) : [],
        merged_content: typeof d.merged_content === 'string' ? d.merged_content : undefined,
        merged_type: VALID_TYPES.includes(d.merged_type as L1RecordType)
          ? (d.merged_type as string)
          : undefined,
        merged_priority: typeof d.merged_priority === 'number' ? d.merged_priority : undefined,
        merged_timestamps: Array.isArray(d.merged_timestamps)
          ? d.merged_timestamps.map(String)
          : undefined,
      });
    }

    // 6. 缺失的记忆补 store（保证每条新记忆都有决策）
    const decidedIds = new Set(decisions.map((d) => d.record_id));
    for (const mem of memories) {
      if (!decidedIds.has(mem.record_id)) {
        decisions.push({ record_id: mem.record_id, action: 'store', target_ids: [] });
      }
    }

    return decisions;
  } catch (err) {
    console.warn(
      `[l1-dedup] parse failed, all store: ${err instanceof Error ? err.message : String(err)}`,
    );
    return storeAllFallback(memories);
  }
}

function storeAllFallback(memories: Array<L1Record & { record_id: string }>): DedupDecision[] {
  return memories.map((m) => ({ record_id: m.record_id, action: 'store' as const, target_ids: [] }));
}

/** 抽取文本中第一个括号平衡的 JSON 数组字面量（正确跳过字符串内的 [ ]）。 */
function extractFirstJsonArray(raw: string): string | null {
  const start = raw.indexOf('[');
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
    } else if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F）。 */
function sanitizeJsonForParse(raw: string): string {
  const escaped = escapeControlCharsInJsonStrings(raw);
  try {
    JSON.parse(escaped);
    return escaped;
  } catch {
    return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }
}

function escapeControlCharsInJsonStrings(raw: string): string {
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

/** repair：去尾逗号 + merged_priority 裸值兜底（如 action 缺失时补 store）。 */
function repairDedupJson(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

// ============================
// applyDecisions
// ============================

/**
 * 按决策落库：
 * - skip → 不落任何东西
 * - store → DualWriter.storeL1({...memory, version: memory.version})
 * - update/merge → 先 vector.remove(target) 每个 target_id，再
 *   DualWriter.storeL1(merged_content/type，version = 新记忆与各 target 的最大 version + 1)
 *
 * @returns 实际落库（或跳过）后的最终 L1Record 列表。
 */
export async function applyDecisions(params: ApplyDecisionsParams): Promise<L1Record[]> {
  const {
    memories,
    decisions,
    storage,
    vector,
    embed,
    baseDir,
    team,
    agent,
  } = params;

  const writer = new DualWriter({ storage, vector, embed, baseDir, team, agent });
  const decisionByRecord = new Map<string, DedupDecision>();
  for (const d of decisions) {
    if (!decisionByRecord.has(d.record_id)) decisionByRecord.set(d.record_id, d);
  }

  const written: L1Record[] = [];

  for (const memory of memories) {
    const decision = decisionByRecord.get(memory.record_id);
    if (!decision || decision.action === 'skip') continue; // skip → 不落

    if (decision.action === 'store') {
      const stored = await writer.storeL1({ ...memory, version: memory.version });
      written.push({ ...memory, version: memory.version });
      void stored;
      continue;
    }

    // update / merge
    // 1. 移除旧候选向量（每个 target_id）
    for (const targetId of decision.target_ids ?? []) {
      vector.remove(targetId);
    }

    // 2. 新记录形状：merged_content/type，version = max(新记忆, 各 target) + 1
    const content = decision.merged_content ?? memory.content;
    const type = normalizeMergedType(decision.merged_type) ?? memory.type;
    const mergedPriority = decision.merged_priority;

    let maxVersion = memory.version;
    for (const targetId of decision.target_ids ?? []) {
      const target = storage.getById(targetId);
      if (target && typeof target.version === 'number' && target.version > maxVersion) {
        maxVersion = target.version;
      }
    }
    const newVersion = maxVersion + 1;

    const mergedRecord: L1Record = {
      ...memory,
      id: memory.id,
      type,
      content,
      priority: mergedPriority ?? memory.priority,
      version: newVersion,
    };

    const stored = await writer.storeL1(mergedRecord);
    written.push(mergedRecord);
    void stored;
  }

  return written;
}

// ============================
// 转换辅助
// ============================

function normalizeMergedType(raw?: string): L1RecordType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower as L1RecordType)) return lower as L1RecordType;
  // legacy 别名
  if (lower === 'episode') return 'episodic';
  if (lower === 'instruct') return 'instruction';
  if (lower === 'preference') return 'persona';
  return null;
}

/** MemoryRow（meta 索引）+ storage（取 FTS content）→ L1Record。 */
function rowToL1Record(
  row: {
    id: string;
    type?: string | null;
    priority?: number | null;
    scene_name?: string | null;
    version?: number | null;
    source_message_ids?: string | null;
    created_at: string;
    team?: string | null;
    agent?: string | null;
  },
  storage: MemoryStorage,
): L1Record {
  return {
    id: row.id,
    type: normalizeMergedType(row.type ?? '') ?? 'episodic',
    content: storage.getContentById(row.id) ?? '',
    priority: typeof row.priority === 'number' ? row.priority : 50,
    scene_name: row.scene_name ?? undefined,
    source_message_ids: parseSourceMessageIds(row.source_message_ids),
    created_at: row.created_at,
    version: typeof row.version === 'number' ? row.version : 1,
    team: row.team ?? undefined,
    agent: row.agent ?? undefined,
  };
}

/** source_message_ids 可能是 JSON 字符串数组或逗号分隔，或 null。 */
function parseSourceMessageIds(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // 非 JSON → 逗号分隔兜底
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
