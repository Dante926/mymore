#!/usr/bin/env node

/**
 * mymore — Stop Hook
 *
 * 不保存任何对话内容。
 * 仅运行 consolidate 维护：清理过期/旧的 session 条目、归档、去重。
 *
 * 记忆存储的唯一方式：Claude 通过 MCP `add_memory` 按需存储精炼摘要。
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { existsSync } from 'fs';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getDbPath, openDb } from './utils/config.js';

setDebugPrefix('store');

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const hi = JSON.parse(input || '{}');
    if (hi.cwd) process.env.MYMORE_CWD = hi.cwd;

    const dbPath = getDbPath();
    if (!existsSync(dbPath)) process.exit(0);

    const db = openDb();

    // 1. Delete old session entries (>1 hour — raw episodes expire fast)
    const stale = db.prepare(
      "SELECT id, fts_rowid FROM memory_meta WHERE category='session' AND created_at < datetime('now', '-1 hour') AND superseded_by IS NULL"
    ).all();
    if (stale.length) {
      const t = db.transaction(() => {
        for (const s of stale) {
          db.prepare('DELETE FROM memory_fts WHERE rowid=?').run(s.fts_rowid);
          db.prepare('DELETE FROM memory_meta WHERE id=?').run(s.id);
        }
      });
      t();
    }

    // 2. Archive expired entries
    const expired = db.prepare("SELECT id FROM memory_meta WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND superseded_by IS NULL").all();
    if (expired.length) {
      const t = db.transaction(() => {
        for (const e of expired) db.prepare("UPDATE memory_meta SET category='archived', frozen=0 WHERE id=?").run(e.id);
      });
      t();
    }

    // 3. Purge archived > 30 days
    const purged = db.prepare("SELECT id, fts_rowid FROM memory_meta WHERE category='archived' AND created_at < datetime('now', '-30 days')").all();
    if (purged.length) {
      const t = db.transaction(() => {
        for (const p of purged) {
          db.prepare('DELETE FROM memory_fts WHERE rowid=?').run(p.fts_rowid);
          db.prepare('DELETE FROM memory_meta WHERE id=?').run(p.id);
        }
      });
      t();
    }

    db.close();
    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    process.exit(0);
  }
}

main();
