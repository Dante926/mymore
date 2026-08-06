var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/storage.ts
var storage_exports = {};
__export(storage_exports, {
  MemoryStorage: () => MemoryStorage,
  computeSha256: () => computeSha256
});
module.exports = __toCommonJS(storage_exports);
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_crypto = require("crypto");
var import_models = require("./models.js");
function computeSha256(content, category, frozen) {
  return (0, import_crypto.createHash)("sha256").update(`${content}::${category}::${frozen}`).digest("hex");
}
var MemoryStorage = class {
  constructor(dbPath) {
    this.db = new import_better_sqlite3.default(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(import_models.SCHEMA_SQL);
    this.runMigration();
  }
  runMigration() {
    for (const stmt of import_models.MIGRATION_SQL.split(";")) {
      const sql = stmt.trim();
      if (!sql)
        continue;
      try {
        this.db.exec(sql);
      } catch {
      }
    }
  }
  add(entry) {
    const sha = computeSha256(entry.content, entry.category, entry.frozen);
    const insertFts = this.db.prepare(
      "INSERT INTO memory_fts (content) VALUES (?)"
    );
    const insertMeta = this.db.prepare(`
      INSERT INTO memory_meta (id, fts_rowid, track, owner_id, category, md_path,
        frozen, created_at, valid_until, superseded_by, session_id, parent_id, group_key, content_sha256,
        type, priority, scene_name, version, source_message_ids, team, agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const addTx = this.db.transaction(() => {
      const result = insertFts.run(entry.content);
      const ftsRowid = result.lastInsertRowid;
      insertMeta.run(
        entry.id,
        ftsRowid,
        entry.track,
        entry.owner_id,
        entry.category,
        "",
        // md_path set later
        entry.frozen ? 1 : 0,
        entry.created_at,
        entry.valid_until ?? null,
        entry.superseded_by ?? null,
        entry.session_id ?? null,
        entry.parent_id ?? null,
        entry.group_key ?? null,
        sha,
        entry.type ?? null,
        entry.priority ?? null,
        entry.scene_name ?? null,
        entry.version ?? null,
        entry.source_message_ids ?? null,
        entry.team ?? null,
        entry.agent ?? null
      );
    });
    addTx();
    return this.getById(entry.id);
  }
  appendToGroup(groupKey, content, entry) {
    const existing = this.db.prepare(
      "SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL"
    ).get(groupKey, entry.owner_id, entry.category);
    if (existing) {
      const existingContent = this.db.prepare(
        "SELECT content FROM memory_fts WHERE rowid = ?"
      ).get(existing.fts_rowid);
      const updated = ((existingContent == null ? void 0 : existingContent.content) ?? "") + "\n" + content;
      const oldId = existing.id;
      this.db.prepare("UPDATE memory_fts SET content = ? WHERE rowid = ?").run(updated, existing.fts_rowid);
      this.db.prepare("UPDATE memory_meta SET access_count = access_count + 1 WHERE id = ?").run(oldId);
      const merged = {
        ...entry,
        id: oldId,
        content: updated,
        group_key: groupKey
      };
      this.updateMdPath(oldId, "");
      return this.getById(oldId);
    }
    const newEntry = {
      ...entry,
      group_key: groupKey
    };
    return this.add(newEntry);
  }
  search(query, filters) {
    const limit = (filters == null ? void 0 : filters.limit) ?? 20;
    const queryBuilder = () => {
      const conditions = ["m.superseded_by IS NULL"];
      const params2 = [];
      if (filters == null ? void 0 : filters.owner_id) {
        conditions.push("m.owner_id = ?");
        params2.push(filters.owner_id);
      }
      if (filters == null ? void 0 : filters.track) {
        conditions.push("m.track = ?");
        params2.push(filters.track);
      }
      if (filters == null ? void 0 : filters.category) {
        conditions.push("m.category = ?");
        params2.push(filters.category);
      }
      if (filters == null ? void 0 : filters.group_key) {
        conditions.push("m.group_key = ?");
        params2.push(filters.group_key);
      }
      if (!(filters == null ? void 0 : filters.include_expired)) {
        conditions.push("(m.valid_until IS NULL OR m.valid_until > datetime('now'))");
      }
      const where2 = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      return { where: where2, params: params2 };
    };
    const runQuery = (sql, qParams) => {
      const rows = this.db.prepare(sql).all(...qParams);
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        category: r.category,
        track: r.track,
        owner_id: r.owner_id,
        frozen: r.frozen === 1,
        created_at: r.created_at,
        valid_until: r.valid_until ?? null,
        superseded_by: r.superseded_by ?? null,
        access_count: r.access_count,
        score: r.score
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
  getById(id) {
    const row = this.db.prepare(
      "SELECT * FROM memory_meta WHERE id = ?"
    ).get(id);
    if (!row)
      return null;
    return this.rowToMemoryRow(row);
  }
  getBySha256(sha) {
    const row = this.db.prepare(
      "SELECT * FROM memory_meta WHERE content_sha256 = ?"
    ).get(sha);
    if (!row)
      return null;
    return this.rowToMemoryRow(row);
  }
  getByMdPath(mdPath) {
    const row = this.db.prepare(
      "SELECT * FROM memory_meta WHERE md_path = ?"
    ).get(mdPath);
    if (!row)
      return null;
    return this.rowToMemoryRow(row);
  }
  getByGroupKey(groupKey, ownerId, category) {
    const sql = category ? "SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL" : "SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND superseded_by IS NULL";
    const params = category ? [groupKey, ownerId, category] : [groupKey, ownerId];
    const row = this.db.prepare(sql).get(...params);
    if (!row)
      return null;
    return this.rowToMemoryRow(row);
  }
  getContentById(id) {
    const row = this.db.prepare(`
      SELECT f.content FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.id = ?
    `).get(id);
    return (row == null ? void 0 : row.content) ?? null;
  }
  updateMdPath(id, mdPath) {
    this.db.prepare("UPDATE memory_meta SET md_path = ? WHERE id = ?").run(mdPath, id);
  }
  updateRow(id, changes) {
    const sets = [];
    const params = [];
    const skip = /* @__PURE__ */ new Set(["id", "fts_rowid", "content_sha256", "created_at"]);
    for (const [key, value] of Object.entries(changes)) {
      if (skip.has(key))
        continue;
      sets.push(`${key} = ?`);
      params.push(value ?? null);
    }
    if (sets.length === 0)
      return;
    params.push(id);
    this.db.prepare(`UPDATE memory_meta SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }
  /**
   * 刷新一条记忆的内容：更新 memory_fts 的 content + 按当前 category/frozen 重算 content_sha256。
   * 维护不变量 content_sha256 = computeSha256(content, category, frozen)（与 JSONL 真源一致）。
   * 注意：应在 updateRow（可能改 category/frozen）之后调用，否则 sha 会基于旧 category/frozen 计算。
   */
  updateContent(id, newContent) {
    const row = this.getById(id);
    if (!row)
      return;
    const sha = computeSha256(newContent, row.category, row.frozen === 1);
    const updateTx = this.db.transaction(() => {
      this.db.prepare("UPDATE memory_fts SET content = ? WHERE rowid = (SELECT fts_rowid FROM memory_meta WHERE id = ?)").run(newContent, id);
      this.db.prepare("UPDATE memory_meta SET content_sha256 = ? WHERE id = ?").run(sha, id);
    });
    updateTx();
  }
  markSuperseded(id, supersededBy) {
    this.db.prepare(`
      UPDATE memory_meta SET superseded_by = ?, category = 'archived', frozen = 0
      WHERE id = ? AND superseded_by IS NULL
    `).run(supersededBy, id);
  }
  incrementAccess(id) {
    this.db.prepare(`
      UPDATE memory_meta SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }
  getFrozenSnapshot(ownerId, maxTokens = 800) {
    const rows = this.db.prepare(`
      SELECT f.content FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.frozen = 1 AND m.owner_id = ? AND m.superseded_by IS NULL
      ORDER BY m.access_count DESC
    `).all(ownerId);
    const parts = [];
    let tokens = 0;
    for (const row of rows) {
      const approxTokens = Math.ceil(row.content.length / 2);
      if (tokens + approxTokens > maxTokens)
        break;
      parts.push(row.content);
      tokens += approxTokens;
    }
    return parts.join("\n");
  }
  listExpired() {
    const rows = this.db.prepare(`
      SELECT * FROM memory_meta
      WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND superseded_by IS NULL
    `).all();
    return rows.map((r) => this.rowToMemoryRow(r));
  }
  purgeArchived(retentionDays = 30) {
    const rows = this.db.prepare(`
      SELECT id, md_path, fts_rowid FROM memory_meta
      WHERE category = 'archived' AND created_at < datetime('now', ?)
    `).all(`-${retentionDays} days`);
    if (rows.length === 0)
      return [];
    const purgeTx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.prepare("DELETE FROM memory_fts WHERE rowid = ?").run(row.fts_rowid);
        this.db.prepare("DELETE FROM memory_meta WHERE id = ?").run(row.id);
      }
    });
    purgeTx();
    return rows.map((r) => ({ id: r.id, md_path: r.md_path }));
  }
  purgeSuperseded(days = 7) {
    const rows = this.db.prepare(`
      SELECT id, md_path, fts_rowid FROM memory_meta
      WHERE superseded_by IS NOT NULL AND created_at < datetime('now', ?)
    `).all(`-${days} days`);
    if (rows.length === 0)
      return [];
    const purgeTx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.prepare("DELETE FROM memory_fts WHERE rowid = ?").run(row.fts_rowid);
        this.db.prepare("DELETE FROM memory_meta WHERE id = ?").run(row.id);
      }
    });
    purgeTx();
    return rows.map((r) => ({ id: r.id, md_path: r.md_path }));
  }
  listByOwner(ownerId, days = 7, category) {
    const conditions = ["m.owner_id = ?", "m.created_at > datetime('now', ?)", "m.superseded_by IS NULL"];
    const params = [ownerId, `-${days} days`];
    if (category) {
      conditions.push("m.category = ?");
      params.push(category);
    }
    const sql = `
      SELECT m.*, f.content FROM memory_meta m
      JOIN memory_fts f ON f.rowid = m.fts_rowid
      WHERE ${conditions.join(" AND ")}
      ORDER BY m.created_at DESC
    `;
    return this.db.prepare(sql).all(...params);
  }
  listByGroupKey(ownerId) {
    const rows = this.db.prepare(`
      SELECT m.*, f.content FROM memory_meta m
      JOIN memory_fts f ON f.rowid = m.fts_rowid
      WHERE m.owner_id = ? AND m.group_key IS NOT NULL AND m.superseded_by IS NULL
      ORDER BY m.group_key, m.created_at
    `).all(ownerId);
    const grouped = {};
    for (const row of rows) {
      const gk = row.group_key;
      if (!grouped[gk])
        grouped[gk] = [];
      grouped[gk].push(row);
    }
    return grouped;
  }
  close() {
    this.db.close();
  }
  rowToMemoryRow(row) {
    return {
      id: row.id,
      fts_rowid: row.fts_rowid,
      track: row.track,
      owner_id: row.owner_id,
      category: row.category,
      md_path: row.md_path,
      frozen: row.frozen,
      created_at: row.created_at,
      valid_until: row.valid_until ?? null,
      superseded_by: row.superseded_by ?? null,
      session_id: row.session_id ?? null,
      parent_id: row.parent_id ?? null,
      group_key: row.group_key ?? null,
      content_sha256: row.content_sha256,
      access_count: row.access_count,
      last_accessed_at: row.last_accessed_at ?? null,
      type: row.type ?? null,
      priority: row.priority ?? null,
      scene_name: row.scene_name ?? null,
      version: row.version ?? null,
      source_message_ids: row.source_message_ids ?? null,
      team: row.team ?? null,
      agent: row.agent ?? null
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MemoryStorage,
  computeSha256
});
