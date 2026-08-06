import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { VectorStore } from '../src/vector.js';

describe('VectorStore', () => {
  let dir: string; let store: VectorStore;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'vec-test-'));
    store = new VectorStore(join(dir, 'vec.db'), 3);
  });
  afterAll(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });

  it('upserts and searches by cosine', () => {
    store.upsert('rec_a', new Float32Array([1, 0, 0]));
    store.upsert('rec_b', new Float32Array([0.9, 0.1, 0]));
    const hits = store.search(new Float32Array([1, 0, 0]), 2);
    expect(hits[0].record_id).toBe('rec_a');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('removes a record', () => {
    store.remove('rec_b');
    const hits = store.search(new Float32Array([0, 1, 0]), 5);
    expect(hits.map(h => h.record_id)).not.toContain('rec_b');
  });
});
