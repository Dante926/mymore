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
export declare const SCHEMA_SQL = "\nCREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(\n    content,\n    tokenize='trigram'\n);\n\nCREATE TABLE IF NOT EXISTS memory_meta (\n    id              TEXT PRIMARY KEY,\n    fts_rowid       INTEGER UNIQUE,\n    track           TEXT NOT NULL,\n    owner_id        TEXT NOT NULL,\n    category        TEXT NOT NULL DEFAULT 'persistent',\n    md_path         TEXT NOT NULL,\n    frozen          INTEGER DEFAULT 0,\n    created_at      TEXT NOT NULL,\n    valid_until     TEXT,\n    superseded_by   TEXT,\n    session_id      TEXT,\n    parent_id       TEXT,\n    group_key       TEXT,\n    content_sha256  TEXT NOT NULL,\n    access_count    INTEGER DEFAULT 0,\n    last_accessed_at TEXT,\n    FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_memory_track_owner ON memory_meta(track, owner_id);\nCREATE INDEX IF NOT EXISTS idx_memory_category ON memory_meta(category);\nCREATE INDEX IF NOT EXISTS idx_memory_frozen ON memory_meta(frozen);\nCREATE INDEX IF NOT EXISTS idx_memory_valid ON memory_meta(valid_until);\n";
export declare const MIGRATION_SQL = "\nALTER TABLE memory_meta ADD COLUMN group_key TEXT;\nCREATE INDEX IF NOT EXISTS idx_memory_group_key ON memory_meta(group_key);\n";
//# sourceMappingURL=models.d.ts.map