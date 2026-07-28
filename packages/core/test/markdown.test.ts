import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MarkdownHandler, mdPathForEntry, groupFilePath } from '../src/markdown.js';
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

  // ── Group-append tests ─────────────────────────────────────

  it('groupFilePath should produce correct path', () => {
    const p = groupFilePath('/root', 'my-project');
    expect(p).toBe('/root/groups/my-project.md');
  });

  it('should append to a new group file (create)', () => {
    const entry: MemoryEntry = {
      id: 'g-test-1', track: 'user', owner_id: 'alice',
      category: 'persistent', content: 'first entry in group',
      created_at: '2026-07-27T10:00:00Z', frozen: false, access_count: 0,
      group_key: 'append-test',
    };
    const relPath = handler.appendToGroup(entry);
    expect(relPath).toBe('groups/append-test.md');
    expect(existsSync(join(tmpDir, 'groups/append-test.md'))).toBe(true);
  });

  it('should append to an existing group file', () => {
    const entry1: MemoryEntry = {
      id: 'g-test-2', track: 'user', owner_id: 'alice',
      category: 'persistent', content: 'second entry',
      created_at: '2026-07-27T11:00:00Z', frozen: false, access_count: 0,
      group_key: 'append-test',
    };
    handler.appendToGroup(entry1);

    const raw = readFileSync(join(tmpDir, 'groups/append-test.md'), 'utf-8');
    // Should have both the first and second entries
    expect(raw).toContain('first entry in group');
    expect(raw).toContain('second entry');
    // Should have two entry headers
    const matches = raw.match(/^## /gm);
    expect(matches).toHaveLength(2);
  });

  it('should read back group entries in order', () => {
    const entries = handler.readGroupEntries('append-test');
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('g-test-1');
    expect(entries[0].content).toContain('first entry in group');
    expect(entries[1].id).toBe('g-test-2');
    expect(entries[1].content).toContain('second entry');
  });

  it('should read group header frontmatter', () => {
    const header = handler.readGroupHeader('append-test');
    expect(header).not.toBeNull();
    expect(header!.group_key).toBe('append-test');
    expect(header!.owner_id).toBe('alice');
    expect(header!.updated_at).toBe('2026-07-27T11:00:00Z');
  });

  it('should scan group files', () => {
    const groups = handler.scanGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some(g => g.path === 'groups/append-test.md')).toBe(true);
    expect(groups[0].sha256.length).toBe(64);
  });

  it('scanAll should include individual files only (groups via scanGroups)', () => {
    const all = handler.scanAll();
    const groupIncluded = all.some(f => f.path.startsWith('groups/'));
    const userIncluded = all.some(f => f.path.startsWith('users/'));
    expect(groupIncluded).toBe(false);  // groups handled by scanGroups
    expect(userIncluded).toBe(true);
  });

  it('should return empty for non-existent group', () => {
    expect(handler.readGroupEntries('non-existent')).toEqual([]);
    expect(handler.readGroupHeader('non-existent')).toBeNull();
  });
});
