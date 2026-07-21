import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MarkdownHandler } from '../src/markdown.js';
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
    expect(relPath).toContain('users/alice/episodes/episode-2026-07-21.md');

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
});
