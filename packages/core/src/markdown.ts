import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, appendFileSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import matter from 'gray-matter';
import { createHash } from 'crypto';
import type { MemoryEntry, Track, Category } from './models.js';

export function mdPathForEntry(rootDir: string, entry: MemoryEntry): string {
  const trackDir = entry.track === 'agent' ? 'agents' : 'users';
  const dir = join(rootDir, trackDir, entry.owner_id, 'episodes');
  return join(dir, `${entry.id}.md`);
}

export function groupFilePath(rootDir: string, groupKey: string): string {
  return join(rootDir, 'groups', `${groupKey}.md`);
}

/** Parse a group file entry header line: "## timestamp | id | track | category" */
function parseEntryHeader(line: string): { timestamp: string; id: string; track: Track; category: Category } | null {
  const trimmed = line.replace(/^##\s*/, '').trim();
  const parts = trimmed.split(/\s*\|\s*/);
  if (parts.length < 4) return null;
  const category = parts[3] as Category;
  if (category !== 'persistent' && category !== 'session' && category !== 'archived') return null;
  const track = parts[2] as Track;
  if (track !== 'user' && track !== 'agent') return null;
  return { timestamp: parts[0], id: parts[1], track, category };
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
    if (entry.parent_id) frontmatter.parent_id = entry.parent_id;
    if (entry.group_key) frontmatter.group_key = entry.group_key;
    if (entry.last_accessed_at) frontmatter.last_accessed_at = entry.last_accessed_at;

    // One entry per file — always write fresh
    const content = matter.stringify(`\n${entry.content}`, frontmatter);
    writeFileSync(filePath, content);

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
      group_key: data.group_key as string | undefined,
      access_count: (data.access_count as number) || 0,
      last_accessed_at: data.last_accessed_at as string | undefined,
    };
  }

  getEntryId(mdPath: string): string | null {
    return this.readEntry(mdPath)?.id ?? null;
  }

  deleteOrMark(mdPath: string): void {
    // Mark the entry as superseded by editing frontmatter
    const entry = this.readEntry(mdPath);
    if (!entry) return;
    entry.superseded_by = '__deleted__';
    this.writeEntry(entry);
  }

  deleteFile(mdPath: string): void {
    const fullPath = join(this.rootDir, mdPath);
    try {
      if (existsSync(fullPath)) unlinkSync(fullPath);
    } catch {
      // ignore if file doesn't exist or can't be deleted
    }
  }

  // ── Group-append methods ──────────────────────────────────────

  /** Append a single entry to a group markdown file (create if not exists). */
  appendToGroup(entry: MemoryEntry): string {
    const fp = groupFilePath(this.rootDir, entry.group_key ?? entry.id);
    mkdirSync(dirname(fp), { recursive: true });

    if (!existsSync(fp)) {
      // Create new group file with header + first entry
      const header: Record<string, unknown> = {
        group_key: entry.group_key ?? entry.id,
        owner_id: entry.owner_id,
        track: entry.track,
        created_at: entry.created_at,
        updated_at: entry.created_at,
      };
      const section = formatGroupSection(entry);
      const content = matter.stringify(`\n${section}`, header);
      writeFileSync(fp, content);
    } else {
      // Read existing, append new section
      const raw = readFileSync(fp, 'utf-8');
      const parsed = matter(raw);
      const body = parsed.content.trimEnd();
      const newBody = body + '\n' + formatGroupSection(entry);
      const header = { ...parsed.data, updated_at: entry.created_at } as Record<string, unknown>;
      const content = matter.stringify(`\n${newBody}`, header);
      writeFileSync(fp, content);
    }

    return relative(this.rootDir, fp);
  }

  /** Read all entries from a group file, ordered by append order (oldest first). */
  readGroupEntries(groupKey: string): MemoryEntry[] {
    const fp = groupFilePath(this.rootDir, groupKey);
    if (!existsSync(fp)) return [];

    const raw = readFileSync(fp, 'utf-8');
    const parsed = matter(raw);
    const header = parsed.data as Record<string, unknown>;
    const body = parsed.content.trim();

    if (!body) return [];

    // Split by "\n---\n" entries
    const sections = body.split(/\n---\n/);
    const entries: MemoryEntry[] = [];
    const defaultOwner = (header.owner_id as string) || 'unknown';

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      const headerLine = lines[0];
      const parsedHeader = parseEntryHeader(headerLine);
      if (!parsedHeader) continue;

      // Content is everything after the header line
      const content = lines.slice(1).join('\n').trim();

      entries.push({
        id: parsedHeader.id,
        track: parsedHeader.track,
        owner_id: defaultOwner,
        category: parsedHeader.category,
        content,
        created_at: parsedHeader.timestamp,
        group_key: groupKey,
        frozen: false,
        access_count: 0,
      });
    }

    return entries;
  }

  /** Read group file header frontmatter. */
  readGroupHeader(groupKey: string): Record<string, unknown> | null {
    const fp = groupFilePath(this.rootDir, groupKey);
    if (!existsSync(fp)) return null;
    const raw = readFileSync(fp, 'utf-8');
    return matter(raw).data as Record<string, unknown>;
  }

  /** Scan all group files in memory/groups/. */
  scanGroups(): { path: string; sha256: string }[] {
    const results: { path: string; sha256: string }[] = [];
    const dir = join(this.rootDir, 'groups');
    if (!existsSync(dir)) return results;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) continue;
      const content = readFileSync(p, 'utf-8');
      const sha = createHash('sha256').update(content).digest('hex');
      results.push({ path: relative(this.rootDir, p), sha256: sha });
    }
    return results;
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
}

/** Format a single entry section for group file. */
function formatGroupSection(entry: MemoryEntry): string {
  const timestamp = entry.created_at;
  const id = entry.id;
  const track = entry.track;
  const category = entry.category;
  return `## ${timestamp} | ${id} | ${track} | ${category}\n\n${entry.content}\n\n---`;
}
