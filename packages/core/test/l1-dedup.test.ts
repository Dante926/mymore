import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { VectorStore, EmbeddingClient } from '../src/vector.js';
import { LLMRunner } from '../src/llm.js';
import { batchDedup, applyDecisions } from '../src/record/l1-dedup.js';
import { DualWriter } from '../src/record/dual-writer.js';
import type { L1Record } from '../src/record/l1-writer.js';

describe('L1 dedup', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  const fakeEmbed = {
    embed: async (t: string) => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0]),
    embedBatch: async (ts: string[]) => ts.map(t => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0])),
  } as unknown as EmbeddingClient;
  const fakeLlm = (output: string) => ({ run: async () => output }) as unknown as LLMRunner;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'l1dedup-'));
    storage = new MemoryStorage(join(dir, 'mem.db'));
    vector = new VectorStore(join(dir, 'vec.db'), 3);
  });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  const rec = (id: string, content: string): L1Record & { record_id: string } => ({
    id, record_id: id, type: 'episodic', content, priority: 80,
    source_message_ids: [], created_at: new Date().toISOString(), version: 1,
  });

  it('llm returns store decisions, applyDecisions writes them', async () => {
    const llm = fakeLlm(JSON.stringify([{ record_id: 'r1', action: 'store', target_ids: [] }]));
    const decisions = await batchDedup({ memories: [rec('r1', '方案A')], llm, vector, embed: fakeEmbed, storage });
    expect(decisions[0].action).toBe('store');
    await applyDecisions({ memories: [rec('r1', '方案A')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    expect(storage.getById('r1')).not.toBeNull();
  });

  it('skip decision writes nothing', async () => {
    const llm = fakeLlm(JSON.stringify([{ record_id: 'r2', action: 'skip', target_ids: [] }]));
    const decisions = await batchDedup({ memories: [rec('r2', '旧信息')], llm, vector, embed: fakeEmbed, storage });
    await applyDecisions({ memories: [rec('r2', '旧信息')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    expect(storage.getById('r2')).toBeNull();
  });

  it('no recall capability → storeAll (fallback)', async () => {
    const llm = fakeLlm('') ; // llm never called
    const decisions = await batchDedup({ memories: [rec('r3', 'x')], llm, storage }); // no vector/embed
    expect(decisions[0].action).toBe('store');
  });

  it('vector recall finds existing candidate; skip with target dedups nothing', async () => {
    // 先把一条旧记忆写进双写（meta + vector + JSONL）
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir });
    await w.storeL1({ ...rec('old_1', '方案A'), version: 1 });
    // 新记忆内容含 A（与 old_1 同一向量 [1,0,0]）
    const llm = fakeLlm(JSON.stringify([
      { record_id: 'r4', action: 'skip', target_ids: ['old_1'] },
    ]));
    const decisions = await batchDedup({
      memories: [rec('r4', '方案A 重复')], llm, vector, embed: fakeEmbed, storage,
    });
    // 向量召回必须找到 old_1
    expect(decisions[0].action).toBe('skip');
    expect(decisions[0].target_ids).toContain('old_1');
    await applyDecisions({ memories: [rec('r4', '方案A 重复')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    expect(storage.getById('r4')).toBeNull(); // skip 不落
    expect(storage.getById('old_1')).not.toBeNull(); // 旧记忆保留
  });

  it('update decision removes old vector and writes merged record with bumped version', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir });
    await w.storeL1({ ...rec('old_2', '方案A'), version: 1 });
    const llm = fakeLlm(JSON.stringify([
      { record_id: 'r5', action: 'update', target_ids: ['old_2'], merged_content: '方案A 更具体的更新', merged_type: 'episodic', merged_priority: 85, merged_timestamps: [] },
    ]));
    const decisions = await batchDedup({
      memories: [rec('r5', '方案A 更具体的更新')], llm, vector, embed: fakeEmbed, storage,
    });
    expect(decisions[0].action).toBe('update');
    await applyDecisions({ memories: [rec('r5', '方案A 更具体的更新')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    // 新记录落库且 version = max(1, old_2 的 1) + 1 = 2
    const row = storage.getById('r5');
    expect(row).not.toBeNull();
    expect(row!.version).toBe(2);
    // 旧向量已移除，新向量按 [1,0,0]（r5 content 含 A）写入
    const hitsA = vector.search(new Float32Array([1,0,0]), 10);
    expect(hitsA.map(h => h.record_id)).not.toContain('old_2');
    expect(hitsA.map(h => h.record_id)).toContain('r5');
    // old_2 不再有任何向量
    expect(vector.search(new Float32Array([0,1,0]), 10).map(h => h.record_id)).not.toContain('old_2');
    // Important #2: target 被 markSuperseded —— 不再被 FTS 召回（superseded_by 指向新记忆 r5）
    const oldRow = storage.getById('old_2');
    expect(oldRow!.superseded_by).toBe('r5');
    expect(oldRow!.category).toBe('archived');
    // storage.search 默认排除 superseded 行（superseded_by IS NULL 条件），旧目标不再浮现
    const ftsHits = storage.search('方案A', { limit: 20 });
    expect(ftsHits.map(h => h.id)).not.toContain('old_2');
  });

  it('hallucinated target in update decision is skipped (not removed/superseded)', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir });
    await w.storeL1({ ...rec('real_target', '方案A'), version: 1 });
    // LLM 幻觉一个不存在的 target + 一个跨租户的 target
    const llm = fakeLlm(JSON.stringify([
      { record_id: 'r7', action: 'update', target_ids: ['ghost_123', 'real_target'], merged_content: '方案A 更具体的更新', merged_type: 'episodic', merged_priority: 85 },
    ]));
    const decisions = await batchDedup({
      memories: [rec('r7', '方案A 更具体的更新')], llm, vector, embed: fakeEmbed, storage,
    });
    expect(decisions[0].action).toBe('update');
    await applyDecisions({ memories: [rec('r7', '方案A 更具体的更新')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    // 新记录落库，version = max(1, real_target 的 1) + 1 = 2（ghost 未纳入计算）
    const row = storage.getById('r7');
    expect(row!.version).toBe(2);
    // ghost_123 从未存在，未被 remove/supersede（无法直接断言 remove，但 getById 保持 null）
    expect(storage.getById('ghost_123')).toBeNull();
    // real_target 是合法 target：被 superseded + 向量移除
    expect(storage.getById('real_target')!.superseded_by).toBe('r7');
    expect(vector.search(new Float32Array([1,0,0]), 10).map(h => h.record_id)).not.toContain('real_target');
  });

  it('update decision does not supersede targets from another tenant', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir });
    // 先写一条 teamA 的记录（meta 带 team）
    await w.storeL1({ ...rec('teamA_rec', '方案A'), version: 1, team: 'teamA', agent: 'agentA' });
    // 新记忆无 team（null 租户），LLM 却把 teamA 的记录列为 target —— 应被租户校验拒绝
    const llm = fakeLlm(JSON.stringify([
      { record_id: 'r8', action: 'merge', target_ids: ['teamA_rec'], merged_content: '合并', merged_type: 'episodic', merged_priority: 80 },
    ]));
    const decisions = await batchDedup({
      memories: [rec('r8', '合并')], llm, vector, embed: fakeEmbed, storage,
    });
    expect(decisions[0].action).toBe('merge');
    await applyDecisions({ memories: [rec('r8', '合并')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    // teamA_rec 未被 superseded、向量未删（跨租户目标被跳过）
    expect(storage.getById('teamA_rec')!.superseded_by).toBeNull();
    expect(storage.getById('teamA_rec')!.category).toBe('persistent');
    expect(vector.search(new Float32Array([1,0,0]), 10).map(h => h.record_id)).toContain('teamA_rec');
    // r8 落库（merge 决策仍落新记录），version 只基于自身 version 1 → 2
    expect(storage.getById('r8')).not.toBeNull();
    expect(storage.getById('r8')!.version).toBe(2);
  });

  it('fenced + noisy llm output parses to decisions', async () => {
    const llm = fakeLlm('```json\n{"noise": true}\n[\n  { "record_id": "r6", "action": "store", "target_ids": [] },\n]\n```');
    const decisions = await batchDedup({ memories: [rec('r6', 'x')], llm, vector, embed: fakeEmbed, storage });
    expect(decisions[0].record_id).toBe('r6');
    expect(decisions[0].action).toBe('store');
  });
});
