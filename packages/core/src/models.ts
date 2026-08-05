
export type Track = 'user' | 'agent';
export type Category = 'persistent' | 'session' | 'archived';

export interface MemoryEntry {
  id: string;
  track: Track;
  owner_id: string;
  category: Category;
  content: string;
  source?: string;
  created_at: string;
  valid_until?: string;
  superseded_by?: string;
  session_id?: string;
  parent_id?: string;
  group_key?: string;
  frozen: boolean;
  access_count: number;
  last_accessed_at?: string;
  type?: string;
  priority?: number;
  scene_name?: string;
  version?: number;
  source_message_ids?: string;
  team?: string;
  agent?: string;
}

export interface MemoryRow {
  id: string;
  fts_rowid: number;
  track: Track;
  owner_id: string;
  category: Category;
  md_path: string;
  frozen: number;
  created_at: string;
  valid_until: string | null;
  superseded_by: string | null;
  session_id: string | null;
  parent_id: string | null;
  group_key: string | null;
  content_sha256: string;
  access_count: number;
  last_accessed_at: string | null;
  type: string | null;
  priority: number | null;
  scene_name: string | null;
  version: number | null;
  source_message_ids: string | null;
  team: string | null;
  agent: string | null;
}

export interface SearchResult {
  id: string;
  content: string;
  category: Category;
  track: Track;
  owner_id: string;
  frozen: boolean;
  created_at: string;
  valid_until: string | null;
  superseded_by: string | null;
  access_count: number;
  score: number;
}

export interface AddMemoryInput {
  content: string;
  owner_id: string;
  track?: Track;
  category?: Category | 'auto';
  valid_until?: string | null;
  session_id?: string | null;
}

export interface SearchFilters {
  owner_id?: string;
  track?: Track;
  category?: Category;
  group_key?: string;
  include_expired?: boolean;
  limit?: number;
}

export interface ConsolidateInput {
  owner_id?: string;
  days?: number;
  dry_run?: boolean;
}

export interface FrozenSnapshotInput {
  owner_id: string;
  max_tokens?: number;
}

// SQL schema constants
export const SCHEMA_SQL = `
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
    type            TEXT,
    priority        INTEGER,
    scene_name      TEXT,
    version         INTEGER,
    source_message_ids TEXT,
    team            TEXT,
    agent           TEXT,
    FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_track_owner ON memory_meta(track, owner_id);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_meta(category);
CREATE INDEX IF NOT EXISTS idx_memory_frozen ON memory_meta(frozen);
CREATE INDEX IF NOT EXISTS idx_memory_valid ON memory_meta(valid_until);
`;

// Migration: add group_key column + index for existing databases
export const MIGRATION_SQL = `
ALTER TABLE memory_meta ADD COLUMN group_key TEXT;
CREATE INDEX IF NOT EXISTS idx_memory_group_key ON memory_meta(group_key);
ALTER TABLE memory_meta ADD COLUMN type TEXT;
ALTER TABLE memory_meta ADD COLUMN priority INTEGER;
ALTER TABLE memory_meta ADD COLUMN scene_name TEXT;
ALTER TABLE memory_meta ADD COLUMN version INTEGER;
ALTER TABLE memory_meta ADD COLUMN source_message_ids TEXT;
ALTER TABLE memory_meta ADD COLUMN team TEXT;
ALTER TABLE memory_meta ADD COLUMN agent TEXT;
`;
