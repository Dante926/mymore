import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage, VectorStore, EmbeddingClient, LLMRunner, recordConversation, DualWriter } from '@mymore/core';
import { L1Runner } from '../src/l1-runner.js';

describe('L1Runner', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  const fakeEmbed = { embed: async (t: string) => new Float32Array([1,0,0]), embedBatch: async (ts: string[]) => ts.map(() => new Float32Array([1,0,0])) } as unknown as EmbeddingClient;
  const fakeLlm = (output: string) => ({ run: async () => output }) as unknown as LLMRunner;

  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l1run-')); storage = new MemoryStorage(join(dir, 'mem.db')); vector = new VectorStore(join(dir, 'vec.db'), 3); });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  it('reads L0 increment and extracts to L1', async () => {
    await recordConversation({ sessionKey: 'projA', baseDir: dir, messages: [{ role: 'user', content: '用户：我用 Rust 写后端', timestamp: 1000 }] });
    const llm = fakeLlm(JSON.stringify([{ scene_name: '技术栈', message_ids: [], memories: [{ content: '用户用 Rust 写后端', type: 'persona', priority: 90, source_message_ids: [], metadata: {} }] }]));
    const runner = new L1Runner({ baseDir: dir, sessionKey: 'projA', llm, storage, vector, embed: fakeEmbed, lastL1Timestamp: 0 });
    const result = await runner.run();
    expect(result.extracted).toBe(1);
    // L1 记录已双写：memory_meta 索引里有 persona 类型的记录（用 content 断言）
    const all = storage.search('Rust', { owner_id: 'default', include_expired: true, limit: 10 });
    expect(all.some(r => r.content.includes('Rust'))).toBe(true);
  });
});
