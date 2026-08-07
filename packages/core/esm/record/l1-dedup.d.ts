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
import type { L1Record } from './l1-writer.js';
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
    memories: Array<L1Record & {
        record_id: string;
    }>;
    llm: LLMRunner;
    vector?: VectorStore;
    embed?: EmbeddingClient;
    storage: MemoryStorage;
    conflictRecallTopK?: number;
    team?: string;
    agent?: string;
}
export interface ApplyDecisionsParams {
    memories: Array<L1Record & {
        record_id: string;
    }>;
    decisions: DedupDecision[];
    storage: MemoryStorage;
    vector: VectorStore;
    embed: EmbeddingClient;
    baseDir: string;
    team?: string;
    agent?: string;
}
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
export declare function batchDedup(params: BatchDedupParams): Promise<DedupDecision[]>;
/**
 * 解析 LLM 批量判定 JSON。容错链：
 * 剥代码块 → 括号平衡抽首数组 → sanitize 控制字符 → JSON.parse（失败 repair 一次）→
 * 逐字段补默认（action→store，target_ids→[]，merged_* 类型校验）→ 缺失记忆补 store。
 */
export declare function parseDedupDecisions(raw: string, memories: Array<L1Record & {
    record_id: string;
}>): DedupDecision[];
/**
 * 按决策落库：
 * - skip → 不落任何东西
 * - store → DualWriter.storeL1({...memory, version: memory.version})
 * - update/merge → 先校验 target_ids（存在 + 同租户 + 非自身，防 LLM 幻觉），落新记录
 *   （merged_content/type，version = 新记忆与各合法 target 的最大 version + 1），再对每个合法
 *   target 调 storage.markSuperseded(target, 新记忆 id) + vector.remove(target)。
 *   顺序：先 storeL1 成功，后动目标 —— storeL1 失败时目标不被误删/误归档。
 *
 * @returns 实际落库（或跳过）后的最终 L1Record 列表。
 */
export declare function applyDecisions(params: ApplyDecisionsParams): Promise<L1Record[]>;
//# sourceMappingURL=l1-dedup.d.ts.map