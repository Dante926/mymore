import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, parse } from 'path';
import matter from 'gray-matter';
import { createHash } from 'crypto';
import type { MemoryEntry, Track, Category } from './models.js';

export function mdPathForEntry(rootDir: string, entry: MemoryEntry): string {
  const trackDir = entry.track === 'agent' ? 'agents' : 'users';
  const date = entry.created_at.slice(0, 10);
  const dir = join(rootDir, trackDir, entry.owner_id, 'episodes');
  return join(dir, `episode-${date}.md`);
}

export class MarkdownHandler {
  constructor(private rootDir: string) {}

  writeEntry(entry: MemoryEntry): string {
    const filePath = mdPathForEntry(this.rootDir, entry);
    mkdirSync(dirname(filePath), { recursive: true });

    const frontmatter: Record<string, unknown> = {
      id: entry.id,
      track: entry.track,
      owner_id: entry.owner_id,
      category: entry.category,
      frozen: entry.frozen,
      created_at: entry.created_at,
      access_count: entry.access_count,
    };
    if (entry.session_id) frontmatter.session_id = entry.session_id;
    if (entry.valid_until) frontmatter.valid_until = entry.valid_until;
    if (entry.superseded_by) frontmatter.superseded_by = entry.superseded_by;

    // Append to existing file or create new
    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    const newEntry = matter.stringify(`\n${entry.content}`, frontmatter);

    if (existing) {
      writeFileSync(filePath, existing.trimEnd() + `\n\n---\n\n${newEntry}`);
    } else {
      writeFileSync(filePath, newEntry);
    }

    return relative(this.rootDir, filePath);
  }

  readEntry(mdPath: string): MemoryEntry | null {
    const fullPath = join(this.rootDir, mdPath);
    if (!existsSync(fullPath)) return null;
    const raw = readFileSync(fullPath, 'utf-8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    return {
      id: data.id as string,
      track: (data.track as Track) || 'user',
      owner_id: data.owner_id as string,
      category: (data.category as Category) || 'persistent',
      content: parsed.content.trim(),
      frozen: Boolean(data.frozen),
      created_at: (data.created_at as string) || '',
      valid_until: data.valid_until as string | undefined,
      superseded_by: data.superseded_by as string | undefined,
      session_id: data.session_id as string | undefined,
      parent_id: data.parent_id as string | undefined,
      access_count: (data.access_count as number) || 0,
      last_accessed_at: data.last_accessed_at as string | undefined,
    };
  }

  getEntryId(mdPath: string): string | null {
    return this.readEntry(mdPath)?.id ?? null;
  }

  scanAll(): { path: string; sha256: string }[] {
    const results: { path: string; sha256: string }[] = [];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (name.endsWith('.md')) {
          const content = readFileSync(p, 'utf-8');
          const sha = createHash('sha256').update(content).digest('hex');
          results.push({ path: relative(this.rootDir, p), sha256: sha });
        }
      }
    };
    walk(join(this.rootDir, 'users'));
    walk(join(this.rootDir, 'agents'));
    return results;
  }

  deleteOrMark(mdPath: string): void {
    // Mark the entry as superseded by editing frontmatter
    const entry = this.readEntry(mdPath);
    if (!entry) return;
    entry.superseded_by = '__deleted__';
    this.writeEntry(entry);
  }
}
