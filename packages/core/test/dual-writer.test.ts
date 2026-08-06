import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { VectorStore, EmbeddingClient } from '../src/vector.js';
import { DualWriter } from '../src/record/dual-writer.js';
import { readL1Records } from '../src/record/l1-writer.js';
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

  it('version-bump does NOT resurrect an archived record', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_4', '方案A', 1));
    await w.deprecateL1('rec_4');
    await w.storeL1(rec('rec_4', '方案A 更新', 2));
    const row = storage.getById('rec_4');
    expect(row).not.toBeNull();
    expect(row!.category).toBe('archived'); // 不被复活
  });

  it('JSONL (source of truth) is written last — embed failure leaves no JSONL line', async () => {
    const failingEmbed = {
      embed: async () => { throw new Error('embed network error'); },
      embedBatch: async () => { throw new Error('embed network error'); },
    } as unknown as EmbeddingClient;
    const w = new DualWriter({ storage, vector, embed: failingEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await expect(w.storeL1(rec('rec_5', '方案B', 1))).rejects.toThrow('embed network error');
    // 索引未写（embed 在索引写入前失败）
    expect(storage.getById('rec_5')).toBeNull();
    // 真源未写（JSONL 最后写，因此失败时没有孤儿行）
    const records = readL1Records(dir, { team: 'dante' });
    expect(records.map(r => r.id)).not.toContain('rec_5');
  });

  it('deprecate updates content_sha256 to (content, archived, false)', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_6', '唯一内容用于sha测试', 1));
    const before = storage.getById('rec_6')!.content_sha256;
    await w.deprecateL1('rec_6');
    const after = storage.getById('rec_6')!.content_sha256;
    expect(after).not.toBe(before);
    // sha 现在匹配 (content, archived, false)：getBySha256 用新 sha 应命中
    expect(storage.getBySha256(after)!.id).toBe('rec_6');
  });

  it('meta team/agent uses record value when present, matching JSONL', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1({ ...rec('rec_7', '方案A', 1), team: 'teamX', agent: 'agentY' });
    const row = storage.getById('rec_7')!;
    expect(row.team).toBe('teamX');
    expect(row.agent).toBe('agentY');
    const fromJsonl = readL1Records(dir, { team: 'teamX' });
    expect(fromJsonl.map(r => r.id)).toContain('rec_7');
  });
});
