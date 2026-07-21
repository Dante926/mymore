import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage, computeSha256 } from '../src/storage.js';
import type { MemoryEntry } from '../src/models.js';

describe('MemoryStorage', () => {
  let tmpDir: string;
  let storage: MemoryStorage;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mymore-test-'));
    storage = new MemoryStorage(join(tmpDir, 'test.db'));
  });

  afterAll(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add a memory and retrieve by id', () => {
    const entry: MemoryEntry = {
      id: 'test-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: '用户偏好暗色模式',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    const row = storage.add(entry);
    expect(row.id).toBe('test-1');
    expect(row.owner_id).toBe('alice');

    const got = storage.getById('test-1');
    expect(got).not.toBeNull();
    expect(got!.id).toBe('test-1');
  });

  it('should search by keyword', () => {
    const results = storage.search('暗色');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('暗色');
  });

  it('should search with owner_id filter', () => {
    const results = storage.search('暗色', { owner_id: 'alice' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search with non-existent owner return empty', () => {
    const results = storage.search('暗色', { owner_id: 'nobody' });
    expect(results.length).toBe(0);
  });

  it('should compute sha256 consistently', () => {
    const sha1 = computeSha256('hello', 'persistent', false);
    const sha2 = computeSha256('hello', 'persistent', false);
    expect(sha1).toBe(sha2);
  });

  it('should get frozen snapshot', () => {
    const snapshot = storage.getFrozenSnapshot('alice', 800);
    expect(typeof snapshot).toBe('string');
  });

  it('should mark superseded', () => {
    const old: MemoryEntry = {
      id: 'old-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: '旧信息',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    storage.add(old);
    const newer: MemoryEntry = {
      id: 'new-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: '新信息',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    storage.add(newer);
    storage.markSuperseded('old-1', 'new-1');
    const got = storage.getById('old-1')!;
    expect(got.superseded_by).toBe('new-1');
  });
});
