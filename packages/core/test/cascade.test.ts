import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { MarkdownHandler } from '../src/markdown.js';
import { CascadeSync } from '../src/cascade.js';
import type { MemoryEntry } from '../src/models.js';

describe('CascadeSync', () => {
  let tmpDir: string;
  let storage: MemoryStorage;
  let md: MarkdownHandler;
  let cascade: CascadeSync;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mymore-cascade-'));
    storage = new MemoryStorage(join(tmpDir, 'cascade.db'));
    md = new MarkdownHandler(join(tmpDir, 'memory'));
    cascade = new CascadeSync(storage, md);
  });

  afterAll(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should sync a new entry', () => {
    const entry: MemoryEntry = {
      id: 'csc-1', track: 'user', owner_id: 'bob',
      category: 'persistent', content: 'cascade 同步测试',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    const result = cascade.syncOne(entry);
    expect(result.changed).toBe(true);
    expect(result.mdPath).toContain('episode');

    // Verify FTS5 has it
    const stored = storage.getById('csc-1');
    expect(stored).not.toBeNull();
  });

  it('should skip unchanged entry on re-sync', () => {
    const entry: MemoryEntry = {
      id: 'csc-1', track: 'user', owner_id: 'bob',
      category: 'persistent', content: 'cascade 同步测试',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    const result = cascade.syncOne(entry);
    expect(result.changed).toBe(false);
  });

  it('should detect change and re-sync', () => {
    const entry: MemoryEntry = {
      id: 'csc-1', track: 'user', owner_id: 'bob',
      category: 'persistent', content: '修改后的内容',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    const result = cascade.syncOne(entry);
    expect(result.changed).toBe(true);
  });

  it('should scan and sync all md files', () => {
    const result = cascade.scanAndSync();
    expect(result.synced).toBeGreaterThanOrEqual(0);
    expect(result.skipped).toBeGreaterThanOrEqual(0);
  });

  it('should look up by md path', () => {
    const entry: MemoryEntry = {
      id: 'csc-mdpath', track: 'user', owner_id: 'alice',
      category: 'persistent', content: 'getByMdPath 测试',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    const result = cascade.syncOne(entry);
    const found = cascade.getByMdPath(result.mdPath);
    expect(found).not.toBeNull();
    expect(found!.id).toBe('csc-mdpath');
  });
});
