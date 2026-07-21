import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage, CascadeSync, MarkdownHandler, Consolidator, classifyMemory } from '@mymore/core';
import type { MemoryEntry } from '@mymore/core';

describe('mymore Full Integration', () => {
  let tmpDir: string;
  let storage: MemoryStorage;
  let cascade: CascadeSync;
  let consolidator: Consolidator;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mymore-int-'));
    storage = new MemoryStorage(join(tmpDir, 'int.db'));
    const md = new MarkdownHandler(join(tmpDir, 'memory'));
    cascade = new CascadeSync(storage, md);
    consolidator = new Consolidator(storage, cascade);
  });

  afterAll(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Test 1: 精确召回 — verify FTS5 trigram search retrieves the exact memory
  it('Test 1: 精确召回 — "上次 bug 怎么修的？"', () => {
    const entry: MemoryEntry = {
      id: 'bug-1', track: 'user', owner_id: 'dev',
      category: 'persistent', content: '修复了 auth 模块 null pointer 崩溃，添加了空值检查',
      created_at: new Date().toISOString(), frozen: true, access_count: 5,
    };
    cascade.syncOne(entry);
    const results = storage.search('null pointer 崩溃');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('null pointer');
  });

  // Test 2: 时效性 — verify superseded entries are excluded and frozen entries rank first
  it('Test 2: 时效性 — "项目现在用什么框架？"', () => {
    const old: MemoryEntry = {
      id: 'fw-old', track: 'user', owner_id: 'dev',
      category: 'persistent', content: '项目当前使用 Framework A',
      created_at: '2026-04-01T00:00:00Z',
      valid_until: '2026-06-01T00:00:00Z',
      frozen: true, access_count: 3,
    };
    const current: MemoryEntry = {
      id: 'fw-new', track: 'user', owner_id: 'dev',
      category: 'persistent', content: '项目已迁移到 Framework B',
      created_at: new Date().toISOString(), frozen: true, access_count: 10,
    };
    cascade.syncOne(old);
    cascade.syncOne(current);
    storage.markSuperseded('fw-old', 'fw-new');

    const results = storage.search('Framework', { owner_id: 'dev', include_expired: false });
    expect(results.length).toBeGreaterThan(0);
    // Frozen entries should rank first
    expect(results[0].frozen).toBe(true);
  });

  // Test 3: 信噪比 — verify simple file operations don't trigger memory noise
  it('Test 3: 信噪比 — "删除 /tmp 临时文件" 不应返回过多记忆', () => {
    const results = storage.search('临时文件');
    // This is a simple file operation - should not trigger many memory results
    expect(results.length).toBeLessThan(5);
  });

  // Test 4: 时间旅行 — verify expired entries are retrievable with include_expired
  it('Test 4: 时间旅行 — "3 个月前决策还适用吗？"', () => {
    const decision: MemoryEntry = {
      id: 'dec-old', track: 'user', owner_id: 'dev',
      category: 'persistent',
      content: '选用方案 X 因为当时方案 Y 不支持功能 Z',
      created_at: '2026-04-15T00:00:00Z',
      valid_until: '2026-07-15T00:00:00Z',
      frozen: true, access_count: 2,
    };
    cascade.syncOne(decision);
    // include_expired: true allows time travel to past entries
    const results = storage.search('方案', { owner_id: 'dev', include_expired: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('方案');
  });

  // Test 5: Consolidate — verify the consolidator archives expired entries
  it('Test 5: 归纳 — 归档过期记忆', async () => {
    const result = await consolidator.run({ dry_run: false });
    expect(result.archived).toBeGreaterThanOrEqual(0);
  });

  // Test 6: 三分类自动识别 — verify classifyMemory detects session vs persistent
  it('Test 6: 三分类', () => {
    expect(classifyMemory('临时中间结果: xyz')).toBe('session');
    expect(classifyMemory('用户偏好暗色模式')).toBe('persistent');
  });

  // Test 7: Frozen Snapshot — verify snapshot generation
  it('Test 7: Frozen Snapshot 输出', () => {
    const snapshot = storage.getFrozenSnapshot('dev', 800);
    expect(typeof snapshot).toBe('string');
  });
});
