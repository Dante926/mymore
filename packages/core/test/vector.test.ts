import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { VectorStore, EmbeddingClient } from '../src/vector.js';

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

describe('EmbeddingClient', () => {
  // 捕获请求体：验证 embeddingModel 优先于 model 回退
  let lastBody: { model?: string; input?: string[] } | null;

  async function fakeFetch(url: string, init: { body?: string }) {
    lastBody = JSON.parse(init.body ?? '{}') as { model?: string; input?: string[] };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: (lastBody!.input ?? []).map(() => ({ embedding: [1, 0, 0] })) }),
    } as unknown as Response;
  }

  afterEach(() => { lastBody = null; });

  it('uses embeddingModel when provided', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    try {
      const client = new EmbeddingClient({ baseUrl: 'http://x', apiKey: 'k', model: 'gpt-4o', embeddingModel: 'text-embed-3' });
      await client.embed('hello');
      expect(lastBody!.model).toBe('text-embed-3');
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('falls back to model when embeddingModel omitted', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    try {
      const client = new EmbeddingClient({ baseUrl: 'http://x', apiKey: 'k', model: 'gpt-4o' });
      await client.embedBatch(['a', 'b']);
      expect(lastBody!.model).toBe('gpt-4o');
      expect(lastBody!.input).toEqual(['a', 'b']);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
