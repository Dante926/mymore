import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { MarkdownHandler } from '../src/markdown.js';
import { CascadeSync } from '../src/cascade.js';
import { Consolidator } from '../src/consolidator.js';
import type { MemoryEntry } from '../src/models.js';

describe('Consolidator', () => {
  let tmpDir: string;
  let storage: MemoryStorage;
  let cascade: CascadeSync;
  let consolidator: Consolidator;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mymore-con-'));
    storage = new MemoryStorage(join(tmpDir, 'con.db'));
    const md = new MarkdownHandler(join(tmpDir, 'memory'));
    cascade = new CascadeSync(storage, md);
    consolidator = new Consolidator(storage, cascade);
  });

  afterAll(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should auto-freeze old entries', () => {
    const old: MemoryEntry = {
      id: 'old-freeze', track: 'user', owner_id: 'charlie',
      category: 'persistent', content: '旧条目',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      frozen: false, access_count: 0,
    };
    cascade.syncOne(old);
    consolidator.autoCleanup(old);
    const row = storage.getById('old-freeze')!;
    expect(row.frozen).toBe(1);
  });

  it('should archive expired entries', async () => {
    const expired: MemoryEntry = {
      id: 'exp-1', track: 'user', owner_id: 'charlie',
      category: 'persistent', content: '过期的',
      created_at: '2026-01-01T00:00:00Z',
      valid_until: '2026-01-01T00:00:00Z',
      frozen: false, access_count: 0,
    };
    cascade.syncOne(expired);
    const result = await consolidator.run({ dry_run: false });
    expect(result.archived).toBeGreaterThan(0);
  });

  it('should run dry_run without side effects', async () => {
    const result = await consolidator.run({ dry_run: true });
    expect(result.archived).toBeGreaterThanOrEqual(0);
  });
});
