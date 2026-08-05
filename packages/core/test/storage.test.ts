import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';
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

  it('should persist structured columns', () => {
    const entry: MemoryEntry = {
      id: 'test-struct-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: '用户确认方案A',
      created_at: new Date().toISOString(), frozen: false, access_count: 0,
      type: 'episodic', priority: 82, scene_name: '做 mymore 改造设计',
      version: 2, source_message_ids: '["msg_1","msg_2"]', team: 'dante', agent: 'arch',
    };
    const row = storage.add(entry);
    expect(row.type).toBe('episodic');
    expect(row.priority).toBe(82);
    expect(row.scene_name).toContain('mymore');
    expect(row.version).toBe(2);
    expect(row.team).toBe('dante');
    expect(row.agent).toBe('arch');
    const got = storage.getById('test-struct-1');
    expect(got!.source_message_ids).toBe('["msg_1","msg_2"]');
  });

  it('should migrate an old DB without structured columns', () => {
    const oldDir = mkdtempSync(join(tmpdir(), 'mymore-migrate-'));
    const dbPath = join(oldDir, 'old.db');
    // Simulate a DB created before the structured columns (and before group_key) existed
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE memory_meta (
        id              TEXT PRIMARY KEY,
        fts_rowid       INTEGER UNIQUE,
        track           TEXT NOT NULL,
        owner_id        TEXT NOT NULL,
        category        TEXT NOT NULL DEFAULT 'persistent',
        md_path         TEXT NOT NULL,
        frozen          INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        valid_until     TEXT,
        superseded_by   TEXT,
        session_id      TEXT,
        parent_id       TEXT,
        content_sha256  TEXT NOT NULL,
        access_count    INTEGER DEFAULT 0,
        last_accessed_at TEXT,
        FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)
      );
    `);
    db.close();

    try {
      // Reopening through MemoryStorage runs SCHEMA_SQL (IF NOT EXISTS) + runMigration()
      const migrated = new MemoryStorage(dbPath);
      expect(() => migrated.getById('nonexistent')).not.toThrow();
      migrated.close();

      const check = new Database(dbPath, { readonly: true });
      const cols = (check.prepare('PRAGMA table_info(memory_meta)').all() as Array<{ name: string }>).map(c => c.name);
      check.close();
      for (const col of ['type', 'priority', 'scene_name', 'version', 'source_message_ids', 'team', 'agent', 'group_key']) {
        expect(cols).toContain(col);
      }
    } finally {
      rmSync(oldDir, { recursive: true, force: true });
    }
  });
});
