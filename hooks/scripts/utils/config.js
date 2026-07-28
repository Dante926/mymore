#!/usr/bin/env node

/**
 * mymore Hooks — Shared Configuration
 *
 * Provides root dir resolution, group_id generation, and database access.
 * Self-contained — no dependency on @mymore/core.
 */

import { join, resolve } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';

const MYMORE_ROOT = process.env.MYMORE_ROOT || join(homedir(), '.mymore');

export function getRootDir() {
  return MYMORE_ROOT;
}

export function getMemoryDir() {
  return join(MYMORE_ROOT, 'memory');
}

export function getDbPath() {
  return join(MYMORE_ROOT, '.index', 'memory.db');
}

export function getSessionFilePath() {
  return join(MYMORE_ROOT, 'sessions.jsonl');
}

/**
 * Generate a stable group_id from a project path.
 * Uses the directory name (last segment of path) as the group_id.
 */
export function getGroupId(cwd) {
  if (!cwd) return 'default';
  const parts = resolve(cwd).split('/').filter(Boolean);
  return parts[parts.length - 1] || 'default';
}

/**
 * Open SQLite DB with Mymore's schema.
 * Creates .index/ directory and initializes tables if needed.
 */
export function openDb() {
  mkdirSync(join(MYMORE_ROOT, '.index'), { recursive: true });
  const db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  // Ensure tables exist
  db.exec(`
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
  `);
  try {
    db.exec(`ALTER TABLE memory_meta ADD COLUMN group_key TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_group_key ON memory_meta(group_key)`);
  } catch { /* already exists */ }
  return db;
}

/**
 * Ensure data directory exists.
 */
export function ensureDataDir() {
  mkdirSync(MYMORE_ROOT, { recursive: true });
}

