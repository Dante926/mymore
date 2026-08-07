/**
 * L1Runner：L0 增量 → L1 提取 → L1 去重 → 双写落库。
 *
 * 消费 @mymore/core 的 L1 管线（extractL1Memories / batchDedup / applyDecisions），
 * 由 PipelineManager.onL1Ready 触发，处理真实 per-session 的 L0 增量：
 * - readConversationMessages(sessionKey, baseDir, lastL1Timestamp) 只读本次增量；
 * - extractL1Memories 单次 LLM 提取（失败或零提取直接返回计数）；
 * - batchDedup（候选召回 + LLM 批量判定）+ applyDecisions（DualWriter 双写）；
 * - 成功后把 lastL1Timestamp 推进到本次消息最大 timestamp（不重复消费）。
 *
 * per-session 语义（Plan 2 I3 接缝）：sessionKey 由构造传入，不使用硬编码 'default'。
 */

import { readConversationMessages, extractL1Memories, batchDedup, applyDecisions } from '@mymore/core';
import type { LLMRunner, MemoryStorage, VectorStore, EmbeddingClient } from '@mymore/core';

export interface L1RunnerOptions {
  baseDir: string;
  sessionKey: string;
  llm: LLMRunner;
  storage: MemoryStorage;
  vector: VectorStore;
  embed: EmbeddingClient;
  lastL1Timestamp: number;
}

export interface L1RunResult {
  extracted: number;
  stored: number;
}

export class L1Runner {
  private baseDir: string;
  private sessionKey: string;
  private llm: LLMRunner;
  private storage: MemoryStorage;
  private vector: VectorStore;
  private embed: EmbeddingClient;
  private lastL1Timestamp: number;

  constructor(opts: L1RunnerOptions) {
    this.baseDir = opts.baseDir;
    this.sessionKey = opts.sessionKey;
    this.llm = opts.llm;
    this.storage = opts.storage;
    this.vector = opts.vector;
    this.embed = opts.embed;
    this.lastL1Timestamp = opts.lastL1Timestamp;
  }

  getLastL1Timestamp(): number {
    return this.lastL1Timestamp;
  }

  async run(): Promise<L1RunResult> {
    const messages = await readConversationMessages(this.sessionKey, this.baseDir, this.lastL1Timestamp);
    if (messages.length === 0) {
      return { extracted: 0, stored: 0 };
    }

    // readConversationMessages 返回精简视图（无 id），而 extractL1Memories 需要
    // ConversationMessage（含 id，供 prompt 的 message_ids/source_message_ids 追踪）。
    // 这里按 timestamp+序号生成稳定 id（L0 JSONL 真源里存有真实 id，供后续精确追踪）。
    const convMessages = messages.map((m, i) => ({
      id: `msg_${m.timestamp}_${i}`,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    }));

    const extraction = await extractL1Memories({
      messages: convMessages,
      llm: this.llm,
      baseDir: this.baseDir,
      sessionKey: this.sessionKey,
    });
    if (!extraction.success || extraction.extractedCount === 0) {
      return { extracted: extraction.extractedCount, stored: extraction.storedCount };
    }

    const memories = extraction.records.map((record) => ({ ...record, record_id: record.id }));
    const decisions = await batchDedup({
      memories,
      llm: this.llm,
      vector: this.vector,
      embed: this.embed,
      storage: this.storage,
    });
    const written = await applyDecisions({
      memories,
      decisions,
      storage: this.storage,
      vector: this.vector,
      embed: this.embed,
      baseDir: this.baseDir,
    });

    // 推进增量游标：本次消息最大 timestamp（readConversationMessages 已按 timestamp 升序）
    const maxTs = messages[messages.length - 1].timestamp;
    if (maxTs > this.lastL1Timestamp) {
      this.lastL1Timestamp = maxTs;
    }

    return { extracted: extraction.extractedCount, stored: written.length };
  }
}
