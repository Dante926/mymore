import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import type { MemoryEntry, MemoryRow, SearchResult, SearchFilters, Track, Category } from './models.js';
import { SCHEMA_SQL, MIGRATION_SQL } from './models.js';

export function computeSha256(content: string, category: string, frozen: boolean): string {
  return createHash('sha256').update(`${content}::${category}::${frozen}`).digest('hex');
}

export class MemoryStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
    this.runMigration();
  }

  private runMigration(): void {
    // Per-statement try/catch: already-added columns must not block the remaining ALTERs
    for (const stmt of MIGRATION_SQL.split(';')) {
      const sql = stmt.trim();
      if (!sql) continue;
      try {
        this.db.exec(sql);
      } catch {
        // column already exists, ignore
      }
    }
  }

  add(entry: MemoryEntry): MemoryRow {
    const sha = computeSha256(entry.content, entry.category, entry.frozen);

    const insertFts = this.db.prepare(
      'INSERT INTO memory_fts (content) VALUES (?)',
    );
    const insertMeta = this.db.prepare(`
      INSERT INTO memory_meta (id, fts_rowid, track, owner_id, category, md_path,
        frozen, created_at, valid_until, superseded_by, session_id, parent_id, group_key, content_sha256,
        type, priority, scene_name, version, source_message_ids, team, agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const addTx = this.db.transaction(() => {
      const result = insertFts.run(entry.content);
      const ftsRowid = result.lastInsertRowid as number;

      insertMeta.run(
        entry.id, ftsRowid, entry.track, entry.owner_id, entry.category, '', // md_path set later
        entry.frozen ? 1 : 0, entry.created_at,
        entry.valid_until ?? null, entry.superseded_by ?? null,
        entry.session_id ?? null, entry.parent_id ?? null,
        entry.group_key ?? null, sha,
        entry.type ?? null, entry.priority ?? null, entry.scene_name ?? null,
        entry.version ?? null, entry.source_message_ids ?? null,
        entry.team ?? null, entry.agent ?? null,
      );
    });

    addTx();
    return this.getById(entry.id)!;
  }

  appendToGroup(groupKey: string, content: string, entry: MemoryEntry): MemoryRow {
    const existing = this.db.prepare(
      'SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL',
    ).get(groupKey, entry.owner_id, entry.category) as Record<string, unknown> | undefined;

    if (existing) {
      // Append to existing FTS entry
      const existingContent = this.db.prepare(
        'SELECT content FROM memory_fts WHERE rowid = ?',
      ).get(existing.fts_rowid as number) as { content: string } | undefined;

      const updated = (existingContent?.content ?? '') + '\n' + content;
      const oldId = existing.id as string;

      this.db.prepare('UPDATE memory_fts SET content = ? WHERE rowid = ?').run(updated, existing.fts_rowid as number);
      this.db.prepare('UPDATE memory_meta SET access_count = access_count + 1 WHERE id = ?').run(oldId);

      // Update md file
      const merged: MemoryEntry = {
        ...entry,
        id: oldId,
        content: updated,
        group_key: groupKey,
      };
      this.updateMdPath(oldId, ''); // cascade will set md_path
      return this.getById(oldId)!;
    }

    // Create new record with group_key
    const newEntry: MemoryEntry = {
      ...entry,
      group_key: groupKey,
    };
    return this.add(newEntry);
  }

  search(query?: string, filters?: SearchFilters): SearchResult[] {
    const limit = filters?.limit ?? 20;
    const queryBuilder = () => {
      const conditions: string[] = ['m.superseded_by IS NULL'];
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
      if (filters?.group_key) {
        conditions.push('m.group_key = ?');
        params.push(filters.group_key);
      }
      if (!filters?.include_expired) {
        conditions.push('(m.valid_until IS NULL OR m.valid_until > datetime(\'now\'))');
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      return { where, params };
    };

    const runQuery = (sql: string, qParams: (string | number)[]): SearchResult[] => {
      const rows = this.db.prepare(sql).all(...qParams) as Array<Record<string, unknown>>;
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
    };

    const { where, params } = queryBuilder();

    if (!query) {
      const sql = `
        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
        FROM memory_fts f
        JOIN memory_meta m ON f.rowid = m.fts_rowid
        ${where}
        ORDER BY m.created_at DESC
        LIMIT ?
      `;
      return runQuery(sql, [...params, limit]);
    }

    const hasCJK = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/.test(query);
    const useLike = query.length <= 2 && hasCJK;

    if (useLike) {
      const sql = `
        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
        FROM memory_fts f
        JOIN memory_meta m ON f.rowid = m.fts_rowid
        ${where} AND f.content LIKE ?
        ORDER BY m.frozen DESC, m.access_count DESC
        LIMIT ?
      `;
      return runQuery(sql, [...params, `%${query}%`, limit]);
    }

    // FTS5 trigram MATCH
    const ftsSql = `
      SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
             m.created_at, m.valid_until, m.superseded_by, m.access_count, rank AS score
      FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      ${where} AND memory_fts MATCH ?
      ORDER BY m.frozen DESC, rank
      LIMIT ?
    `;
    const ftsResults = runQuery(ftsSql, [...params, query, limit]);

    // FTS5 trigram can miss longer CJK queries — fall back to LIKE
    if (ftsResults.length === 0 && hasCJK) {
      const likeSql = `
        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
        FROM memory_fts f
        JOIN memory_meta m ON f.rowid = m.fts_rowid
        ${where} AND f.content LIKE ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `;
      return runQuery(likeSql, [...params, `%${query}%`, limit]);
    }

    return ftsResults;
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

  getByMdPath(mdPath: string): MemoryRow | null {
    const row = this.db.prepare(
      'SELECT * FROM memory_meta WHERE md_path = ?',
    ).get(mdPath) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMemoryRow(row);
  }

  getByGroupKey(groupKey: string, ownerId: string, category?: string): MemoryRow | null {
    const sql = category
      ? 'SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL'
      : 'SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND superseded_by IS NULL';
    const params: unknown[] = category ? [groupKey, ownerId, category] : [groupKey, ownerId];
    const row = this.db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMemoryRow(row);
  }

  getContentById(id: string): string | null {
    const row = this.db.prepare(`
      SELECT f.content FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.id = ?
    `).get(id) as { content: string } | undefined;
    return row?.content ?? null;
  }

  updateMdPath(id: string, mdPath: string): void {
    this.db.prepare('UPDATE memory_meta SET md_path = ? WHERE id = ?').run(mdPath, id);
  }

  updateRow(id: string, changes: Partial<MemoryRow>): void {
    const sets: string[] = [];
    const params: unknown[] = [];
    const skip = new Set(['id', 'fts_rowid', 'content_sha256', 'created_at']);
    for (const [key, value] of Object.entries(changes)) {
      if (skip.has(key)) continue;
      sets.push(`${key} = ?`);
      params.push(value ?? null);
    }
    if (sets.length === 0) return;
    params.push(id);
    this.db.prepare(`UPDATE memory_meta SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  /**
   * 刷新一条记忆的内容：更新 memory_fts 的 content + 按当前 category/frozen 重算 content_sha256。
   * 维护不变量 content_sha256 = computeSha256(content, category, frozen)（与 JSONL 真源一致）。
   * 注意：应在 updateRow（可能改 category/frozen）之后调用，否则 sha 会基于旧 category/frozen 计算。
   */
  updateContent(id: string, newContent: string): void {
    const row = this.getById(id);
    if (!row) return;
    const sha = computeSha256(newContent, row.category, row.frozen === 1);
    const updateTx = this.db.transaction(() => {
      this.db
        .prepare('UPDATE memory_fts SET content = ? WHERE rowid = (SELECT fts_rowid FROM memory_meta WHERE id = ?)')
        .run(newContent, id);
      this.db.prepare('UPDATE memory_meta SET content_sha256 = ? WHERE id = ?').run(sha, id);
    });
    updateTx();
  }

  /**
   * 按当前 FTS content + category/frozen 重算 content_sha256（不改动 FTS content）。
   * 用于 deprecateL1/markSuperseded 这类 category/frozen 变更后维持不变量
   * content_sha256 = computeSha256(content, category, frozen)。
   */
  updateSha(id: string): void {
    const row = this.getById(id);
    if (!row) return;
    const content = this.getContentById(id) ?? '';
    const sha = computeSha256(content, row.category, row.frozen === 1);
    this.db.prepare('UPDATE memory_meta SET content_sha256 = ? WHERE id = ?').run(sha, id);
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

  purgeArchived(retentionDays = 30): { id: string; md_path: string }[] {
    const rows = this.db.prepare(`
      SELECT id, md_path, fts_rowid FROM memory_meta
      WHERE category = 'archived' AND created_at < datetime('now', ?)
    `).all(`-${retentionDays} days`) as { id: string; md_path: string; fts_rowid: number }[];

    if (rows.length === 0) return [];

    const purgeTx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.fts_rowid);
        this.db.prepare('DELETE FROM memory_meta WHERE id = ?').run(row.id);
      }
    });
    purgeTx();

    return rows.map(r => ({ id: r.id, md_path: r.md_path }));
  }

  purgeSuperseded(days = 7): { id: string; md_path: string }[] {
    const rows = this.db.prepare(`
      SELECT id, md_path, fts_rowid FROM memory_meta
      WHERE superseded_by IS NOT NULL AND created_at < datetime('now', ?)
    `).all(`-${days} days`) as { id: string; md_path: string; fts_rowid: number }[];

    if (rows.length === 0) return [];

    const purgeTx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.fts_rowid);
        this.db.prepare('DELETE FROM memory_meta WHERE id = ?').run(row.id);
      }
    });
    purgeTx();

    return rows.map(r => ({ id: r.id, md_path: r.md_path }));
  }

  listByOwner(ownerId: string, days = 7, category?: string): (MemoryRow & { content: string })[] {
    const conditions = ['m.owner_id = ?', "m.created_at > datetime('now', ?)", 'm.superseded_by IS NULL'];
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

  listByGroupKey(ownerId: string): Record<string, (MemoryRow & { content: string })[]> {
    const rows = this.db.prepare(`
      SELECT m.*, f.content FROM memory_meta m
      JOIN memory_fts f ON f.rowid = m.fts_rowid
      WHERE m.owner_id = ? AND m.group_key IS NOT NULL AND m.superseded_by IS NULL
      ORDER BY m.group_key, m.created_at
    `).all(ownerId) as (MemoryRow & { content: string })[];
    const grouped: Record<string, (MemoryRow & { content: string })[]> = {};
    for (const row of rows) {
      const gk = row.group_key!;
      if (!grouped[gk]) grouped[gk] = [];
      grouped[gk].push(row);
    }
    return grouped;
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
      group_key: (row.group_key as string) ?? null,
      content_sha256: row.content_sha256 as string,
      access_count: row.access_count as number,
      last_accessed_at: (row.last_accessed_at as string) ?? null,
      type: (row.type as string) ?? null,
      priority: (row.priority as number) ?? null,
      scene_name: (row.scene_name as string) ?? null,
      version: (row.version as number) ?? null,
      source_message_ids: (row.source_message_ids as string) ?? null,
      team: (row.team as string) ?? null,
      agent: (row.agent as string) ?? null,
    };
  }
}
