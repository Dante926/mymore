#!/usr/bin/env node

/**
 * mymore Hooks — Shared Configuration
 *
 * Provides root dir resolution, group_id generation, and database access.
 * Uses @mymore/core for all database operations — no direct SQL.
 */

import { join, resolve } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { MemoryStorage, MarkdownHandler, CascadeSync, Consolidator } from '@mymore/core';

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
 * Create a MemoryStorage instance (ensures DB and schema exist).
 */
export function createStorage() {
  if (!existsSync(join(MYMORE_ROOT, '.index'))) {
    mkdirSync(join(MYMORE_ROOT, '.index'), { recursive: true });
  }
  return new MemoryStorage(getDbPath());
}

/**
 * Create a Consolidator instance for cleanup/maintenance.
 */
export function createConsolidator() {
  const storage = createStorage();
  const md = new MarkdownHandler(getMemoryDir());
  const cascade = new CascadeSync(storage, md);
  return new Consolidator(storage, cascade, md);
}

/**
 * Ensure data directory exists.
 */
export function ensureDataDir() {
  mkdirSync(MYMORE_ROOT, { recursive: true });
}
