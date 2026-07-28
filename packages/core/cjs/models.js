var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/models.ts
var models_exports = {};
__export(models_exports, {
  MIGRATION_SQL: () => MIGRATION_SQL,
  SCHEMA_SQL: () => SCHEMA_SQL
});
module.exports = __toCommonJS(models_exports);
var SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    content,
    tokenize='trigram'
);

CREATE TABLE IF NOT EXISTS memory_meta (
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
    group_key       TEXT,
    content_sha256  TEXT NOT NULL,
    access_count    INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_track_owner ON memory_meta(track, owner_id);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_meta(category);
CREATE INDEX IF NOT EXISTS idx_memory_frozen ON memory_meta(frozen);
CREATE INDEX IF NOT EXISTS idx_memory_valid ON memory_meta(valid_until);
`;
var MIGRATION_SQL = `
ALTER TABLE memory_meta ADD COLUMN group_key TEXT;
CREATE INDEX IF NOT EXISTS idx_memory_group_key ON memory_meta(group_key);
`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MIGRATION_SQL,
  SCHEMA_SQL
});
