import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { VectorStore, EmbeddingClient } from '../src/vector.js';
import { DualWriter } from '../src/record/dual-writer.js';
import type { L1Record } from '../src/record/l1-writer.js';

describe('DualWriter', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  let fakeEmbed: EmbeddingClient;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dual-test-'));
    storage = new MemoryStorage(join(dir, 'memory.db'));
    vector = new VectorStore(join(dir, 'vec.db'), 3);
    fakeEmbed = {
      embed: async (t: string) => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0]),
      embedBatch: async (ts: string[]) => ts.map(t => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0])),
    } as unknown as EmbeddingClient;
  });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  const rec = (id: string, content: string, v: number): L1Record => ({
    id, type: 'episodic', content, priority: 80,
    source_message_ids: [], created_at: new Date().toISOString(), version: v,
  });

  it('writes JSONL + meta + vector', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_1', '方案A', 1));
    expect(storage.getById('rec_1')!.type).toBe('episodic');
    expect(storage.getById('rec_1')!.team).toBe('dante');
    const hits = vector.search(new Float32Array([1,0,0]), 5);
    expect(hits.map(h => h.record_id)).toContain('rec_1');
  });

  it('version>1 removes old vector, keeps new', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_2', '方案A', 1));
    await w.storeL1(rec('rec_2', '方案B(更新)', 2));
    const hits = vector.search(new Float32Array([1,0,0]), 10);
    expect(hits.map(h => h.record_id)).not.toContain('rec_2');
    const hitsB = vector.search(new Float32Array([0,1,0]), 10);
    expect(hitsB.map(h => h.record_id)).toContain('rec_2');
  });

  it('deprecate removes vector', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_3', '方案A', 1));
    await w.deprecateL1('rec_3');
    const hits = vector.search(new Float32Array([1,0,0]), 10);
    expect(hits.map(h => h.record_id)).not.toContain('rec_3');
  });
});
