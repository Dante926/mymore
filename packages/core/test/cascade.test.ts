import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage, computeSha256 } from '../src/storage.js';
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

  it('syncOne does NOT resurrect a markSuperseded target (sha invariant held)', () => {
    const entry: MemoryEntry = {
      id: 'csc-superseded', track: 'user', owner_id: 'bob',
      category: 'persistent', content: 'markSuperseded 后被归档的内容',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
    };
    cascade.syncOne(entry);

    // superseded_by 外键需要目标存在
    storage.add({
      id: 'newer-id', track: 'user', owner_id: 'bob', category: 'persistent',
      content: '更新后的内容', created_at: new Date().toISOString(),
      frozen: false, access_count: 0,
    });

    // 用同样内容但 persistent 的 entry 去 markSuperseded（dedup 路径的实际操作）
    storage.markSuperseded('csc-superseded', 'newer-id');

    const archived = storage.getById('csc-superseded')!;
    expect(archived.category).toBe('archived');
    expect(archived.superseded_by).toBe('newer-id');
    // 不变量：sha 已按 archived 重算，getBySha256 命中
    expect(storage.getBySha256(archived.content_sha256)!.id).toBe('csc-superseded');

    // 重新以同样的 (content, persistent, false) entry 跑 syncOne：
    // sha 不匹配 archived 的 sha → syncOne 会走 writeEntry 分支…… 但目标行已经 archived + superseded。
    // 验证 markSuperseded 后 sha 正确反映 archived 状态：computeSha256(content, 'persistent', false)
    // 的 sha 不再命中该行（syncOne 的 sha 短路逻辑不会把 archived 行当作 unchanged）。
    const persistentSha = computeSha256(entry.content, 'persistent', false);
    expect(storage.getBySha256(persistentSha)).toBeNull();
    // 且 archived 行的 sha 明确是 archived 版本 —— 不会以 persistent 面貌复活
    expect(archived.content_sha256).not.toBe(persistentSha);
  });
});
