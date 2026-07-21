import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MarkdownHandler, mdPathForEntry } from '../src/markdown.js';
import type { MemoryEntry } from '../src/models.js';

describe('MarkdownHandler', () => {
  let tmpDir: string;
  let handler: MarkdownHandler;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mymore-md-'));
    handler = new MarkdownHandler(tmpDir);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write and read back an entry', () => {
    const entry: MemoryEntry = {
      id: 'md-test-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: '测试内容',
      created_at: '2026-07-21T10:00:00Z', frozen: false, access_count: 0,
    };
    const relPath = handler.writeEntry(entry);
    expect(relPath).toContain('users/alice/episodes/md-test-1.md');
    expect(relPath).not.toContain('episode-');

    const read = handler.readEntry(relPath);
    expect(read).not.toBeNull();
    expect(read!.id).toBe('md-test-1');
    expect(read!.content).toContain('测试内容');
  });

  it('should scan all md files', () => {
    const files = handler.scanAll();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0].sha256.length).toBe(64);
  });

  it('should return null for nonexistent file', () => {
    expect(handler.readEntry('nonexistent.md')).toBeNull();
  });

  it('should mark entry as deleted via deleteOrMark', () => {
    const entry: MemoryEntry = {
      id: 'md-delete-test', track: 'user', owner_id: 'alice',
      category: 'session', content: 'delete me',
      created_at: '2026-07-21T12:00:00Z', frozen: false, access_count: 0,
    };
    const relPath = handler.writeEntry(entry);
    handler.deleteOrMark(relPath);

    const read = handler.readEntry(relPath);
    expect(read).not.toBeNull();
    expect(read!.superseded_by).toBe('__deleted__');
  });

  it('should get entry id via getEntryId', () => {
    const entry: MemoryEntry = {
      id: 'md-getid-test', track: 'user', owner_id: 'alice',
      category: 'persistent', content: 'find me by id',
      created_at: '2026-07-21T13:00:00Z', frozen: false, access_count: 0,
    };
    const relPath = handler.writeEntry(entry);
    expect(handler.getEntryId(relPath)).toBe('md-getid-test');
    expect(handler.getEntryId('nope.md')).toBeNull();
  });

  it('should work with agent track', () => {
    const entry: MemoryEntry = {
      id: 'md-agent-1', track: 'agent', owner_id: 'bob',
      category: 'persistent', content: 'agent memory',
      created_at: '2026-07-21T14:00:00Z', frozen: false, access_count: 0,
    };
    const relPath = handler.writeEntry(entry);
    expect(relPath).toContain('agents/bob/episodes/md-agent-1.md');

    const read = handler.readEntry(relPath);
    expect(read).not.toBeNull();
    expect(read!.track).toBe('agent');
    expect(read!.owner_id).toBe('bob');
  });

  it('should handle optional fields', () => {
    const entry: MemoryEntry = {
      id: 'md-opts-1', track: 'user', owner_id: 'carol',
      category: 'session', content: 'with options',
      source: 'cli',
      created_at: '2026-07-21T15:00:00Z',
      valid_until: '2026-07-28T15:00:00Z',
      session_id: 'sess-123',
      parent_id: 'parent-456',
      frozen: false, access_count: 5,
      last_accessed_at: '2026-07-21T16:00:00Z',
    };
    const relPath = handler.writeEntry(entry);
    const read = handler.readEntry(relPath);
    expect(read).not.toBeNull();
    expect(read!.valid_until).toBe('2026-07-28T15:00:00Z');
    expect(read!.session_id).toBe('sess-123');
    expect(read!.parent_id).toBe('parent-456');
    expect(read!.access_count).toBe(5);
    expect(read!.last_accessed_at).toBe('2026-07-21T16:00:00Z');
  });

  it('mdPathForEntry should produce correct one-entry-per-file path', () => {
    const entry: MemoryEntry = {
      id: 'uniq-id', track: 'user', owner_id: 'dave',
      category: 'persistent', content: 'x',
      created_at: '2026-07-21T17:00:00Z', frozen: false, access_count: 0,
    };
    const p = mdPathForEntry('/root', entry);
    expect(p).toBe('/root/users/dave/episodes/uniq-id.md');
  });
});
