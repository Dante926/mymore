import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import type { MemoryEntry, MemoryRow, SearchResult, SearchFilters, Track, Category } from './models.js';
import { SCHEMA_SQL } from './models.js';

export function computeSha256(content: string, category: string, frozen: boolean): string {
  return createHash('sha256').update(`${content}::${category}::${frozen}`).digest('hex');
}

export class MemoryStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = OFF');
    this.db.exec(SCHEMA_SQL);
  }

  add(entry: MemoryEntry): MemoryRow {
    const sha = computeSha256(entry.content, entry.category, entry.frozen);

    const insertFts = this.db.prepare(
      'INSERT INTO memory_fts (content) VALUES (?)',
    );
    const result = insertFts.run(entry.content);
    const ftsRowid = result.lastInsertRowid as number;

    const insertMeta = this.db.prepare(`
      INSERT INTO memory_meta (id, fts_rowid, track, owner_id, category, md_path,
        frozen, created_at, valid_until, superseded_by, session_id, parent_id, content_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMeta.run(
      entry.id, ftsRowid, entry.track, entry.owner_id, entry.category, '', // md_path set later
      entry.frozen ? 1 : 0, entry.created_at,
      entry.valid_until ?? null, entry.superseded_by ?? null,
      entry.session_id ?? null, entry.parent_id ?? null, sha,
    );

    return this.getById(entry.id)!;
  }

  search(query: string, filters?: SearchFilters): SearchResult[] {
    const limit = filters?.limit ?? 5;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.owner_id) {
      conditions.push('m.owner_id = ?');
      params.push(filters.owner_id);
    }
    if (filters?.track) {
      conditions.push('m.track = ?');
      params.push(filters.track);
    }
    if (filters?.category) {
      conditions.push('m.category = ?');
      params.push(filters.category);
    }
    if (!filters?.include_expired) {
      conditions.push('(m.valid_until IS NULL OR m.valid_until > datetime(\'now\'))');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const useLike = query.length <= 2 && /[一-鿿]/.test(query);

    let sql: string;
    if (useLike) {
      sql = `
        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
        FROM memory_fts f
        JOIN memory_meta m ON f.rowid = m.fts_rowid
        ${where} AND f.content LIKE ?
        ORDER BY m.frozen DESC, m.access_count DESC
        LIMIT ?
      `;
      params.push(`%${query}%`, limit);
    } else {
      sql = `
        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
               m.created_at, m.valid_until, m.superseded_by, m.access_count, rank AS score
        FROM memory_fts f
        JOIN memory_meta m ON f.rowid = m.fts_rowid
        ${where} AND memory_fts MATCH ?
        ORDER BY m.frozen DESC, rank
        LIMIT ?
      `;
      params.push(query, limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      content: r.content as string,
      category: r.category as Category,
      track: r.track as Track,
      owner_id: r.owner_id as string,
      frozen: (r.frozen as number) === 1,
      created_at: r.created_at as string,
      valid_until: (r.valid_until as string) ?? null,
      superseded_by: (r.superseded_by as string) ?? null,
      access_count: r.access_count as number,
      score: r.score as number,
    }));
  }

  getById(id: string): MemoryRow | null {
    const row = this.db.prepare(
      'SELECT * FROM memory_meta WHERE id = ?',
    ).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMemoryRow(row);
  }

  getBySha256(sha: string): MemoryRow | null {
    const row = this.db.prepare(
      'SELECT * FROM memory_meta WHERE content_sha256 = ?',
    ).get(sha) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMemoryRow(row);
  }

  updateMdPath(id: string, mdPath: string): void {
    this.db.prepare('UPDATE memory_meta SET md_path = ? WHERE id = ?').run(mdPath, id);
  }

  updateRow(id: string, changes: Partial<MemoryRow>): void {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'id') continue;
      sets.push(`${key} = ?`);
      params.push(value ?? null);
    }
    if (sets.length === 0) return;
    params.push(id);
    this.db.prepare(`UPDATE memory_meta SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  markSuperseded(id: string, supersededBy: string): void {
    this.db.prepare(`
      UPDATE memory_meta SET superseded_by = ?, category = 'archived', frozen = 0
      WHERE id = ? AND superseded_by IS NULL
    `).run(supersededBy, id);
  }

  incrementAccess(id: string): void {
    this.db.prepare(`
      UPDATE memory_meta SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  getFrozenSnapshot(ownerId: string, maxTokens = 800): string {
    const rows = this.db.prepare(`
      SELECT f.content FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.frozen = 1 AND m.owner_id = ? AND m.superseded_by IS NULL
      ORDER BY m.access_count DESC
    `).all(ownerId) as Array<{ content: string }>;

    const parts: string[] = [];
    let tokens = 0;
    for (const row of rows) {
      const approxTokens = Math.ceil(row.content.length / 2);
      if (tokens + approxTokens > maxTokens) break;
      parts.push(row.content);
      tokens += approxTokens;
    }
    return parts.join('\n');
  }

  listExpired(): MemoryRow[] {
    const rows = this.db.prepare(`
      SELECT * FROM memory_meta
      WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND superseded_by IS NULL
    `).all() as Array<Record<string, unknown>>;
    return rows.map(r => this.rowToMemoryRow(r));
  }

  listByOwner(ownerId: string, days = 7, category?: string): (MemoryRow & { content: string })[] {
    const conditions = ['m.owner_id = ?', "m.created_at > datetime('now', ?)"];
    const params: unknown[] = [ownerId, `-${days} days`];
    if (category) {
      conditions.push('m.category = ?');
      params.push(category);
    }
    const sql = `
      SELECT m.*, f.content FROM memory_meta m
      JOIN memory_fts f ON f.rowid = m.fts_rowid
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.created_at DESC
    `;
    return this.db.prepare(sql).all(...params) as (MemoryRow & { content: string })[];
  }

  close(): void {
    this.db.close();
  }

  private rowToMemoryRow(row: Record<string, unknown>): MemoryRow {
    return {
      id: row.id as string,
      fts_rowid: row.fts_rowid as number,
      track: row.track as Track,
      owner_id: row.owner_id as string,
      category: row.category as Category,
      md_path: row.md_path as string,
      frozen: row.frozen as number,
      created_at: row.created_at as string,
      valid_until: (row.valid_until as string) ?? null,
      superseded_by: (row.superseded_by as string) ?? null,
      session_id: (row.session_id as string) ?? null,
      parent_id: (row.parent_id as string) ?? null,
      content_sha256: row.content_sha256 as string,
      access_count: row.access_count as number,
      last_accessed_at: (row.last_accessed_at as string) ?? null,
    };
  }
}
