#!/usr/bin/env node

/**
 * mymore — Stop Hook
 *
 * 1) 自动保存最后一轮对话原文（raw episode）
 * 2) 运行 consolidate 维护（归档过期、清理噪音）
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID, createHash } from 'crypto';
import matter from 'gray-matter';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getDbPath, getMemoryDir, openDb } from './utils/config.js';

setDebugPrefix('store');

function hasContent(text) { return text && text.trim().length > 0; }

// ── Markdown append ──
function appendToGroupMd(entry) {
  const mdDir = getMemoryDir();
  const fp = join(mdDir, 'groups', `${entry.group_key}.md`);
  mkdirSync(join(mdDir, 'groups'), { recursive: true });
  const section = `## ${entry.created_at} | ${entry.id} | ${entry.track} | ${entry.category}\n\n${entry.content}\n\n---`;
  if (!existsSync(fp)) {
    writeFileSync(fp, matter.stringify(`\n${section}`, {
      group_key: entry.group_key, owner_id: entry.owner_id, track: entry.track,
      created_at: entry.created_at, updated_at: entry.created_at,
    }));
  } else {
    const raw = readFileSync(fp, 'utf-8');
    const parsed = matter(raw);
    writeFileSync(fp, matter.stringify(`\n${parsed.content.trimEnd()}\n${section}`, { ...parsed.data, updated_at: entry.created_at }));
  }
}

// ── FTS5 append (same group_key = merge content into one row) ──
function appendToFts5(db, groupKey, content, entry) {
  const existing = db.prepare("SELECT id, fts_rowid FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL")
    .get(groupKey, entry.owner_id, entry.category);
  if (existing) {
    const old = db.prepare('SELECT content FROM memory_fts WHERE rowid = ?').get(existing.fts_rowid);
    const updated = (old?.content || '') + '\n' + content;
    db.prepare('UPDATE memory_fts SET content = ? WHERE rowid = ?').run(updated, existing.fts_rowid);
    db.prepare('UPDATE memory_meta SET created_at = ?, access_count = access_count + 1 WHERE id = ?').run(entry.created_at, existing.id);
    return existing.id;
  }
  const fts = db.prepare('INSERT INTO memory_fts (content) VALUES (?)');
  const meta = db.prepare("INSERT INTO memory_meta (id,fts_rowid,track,owner_id,category,md_path,frozen,created_at,group_key,content_sha256) VALUES (?,?,?,?,?,'',0,?,?,?)");
  const tx = db.transaction(() => {
    const r = fts.run(content);
    const sha = createHash('sha256').update(`${content}::${entry.category}::false`).digest('hex');
    meta.run(entry.id, r.lastInsertRowid, entry.track, entry.owner_id, entry.category, entry.created_at, groupKey, sha);
  });
  tx();
  return entry.id;
}

// ── Extract last turn from transcript ──
function extractLastTurn(lines) {
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const e = JSON.parse(lines[i]); if (e.type === 'system' && e.subtype === 'turn_duration') { start = i + 1; break; } } catch {}
  }
  const user = [], assistant = [];
  for (let i = start; i < lines.length; i++) {
    try {
      const e = JSON.parse(lines[i]), c = e.message?.content;
      if (e.type === 'user') {
        if (typeof c === 'string') user.push(c);
        else if (Array.isArray(c)) for (const b of c) { if (b.type === 'text' && b.text) user.push(b.text); }
      }
      if (e.type === 'assistant') {
        if (Array.isArray(c)) for (const b of c) { if (b.type === 'text' && b.text) assistant.push(b.text); }
        else if (typeof c === 'string') assistant.push(c);
      }
    } catch {}
  }
  return { user: user.join('\n\n'), assistant: assistant.join('\n\n') };
}

// ── Consolidate: archive expired, dedup, purge ──
function runConsolidate(db) {
  const archived = db.prepare("SELECT id FROM memory_meta WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND superseded_by IS NULL").all();
  if (archived.length) {
    const t = db.transaction(() => { for (const e of archived) db.prepare("UPDATE memory_meta SET category='archived', frozen=0 WHERE id=?").run(e.id); });
    t();
  }

  // Dedup by group_key: keep latest, deprecate older
  const groups = db.prepare("SELECT group_key, owner_id, category FROM memory_meta WHERE group_key IS NOT NULL AND superseded_by IS NULL AND category='session' GROUP BY group_key, owner_id, category").all();
  for (const g of groups) {
    const rows = db.prepare("SELECT id FROM memory_meta WHERE group_key=? AND owner_id=? AND category=? AND superseded_by IS NULL ORDER BY created_at DESC").all(g.group_key, g.owner_id, g.category);
    if (rows.length > 1) {
      const keeper = rows[0];
      const tx = db.transaction(() => {
        for (let i = 1; i < rows.length; i++) db.prepare("UPDATE memory_meta SET superseded_by=?, category='archived' WHERE id=?").run(keeper.id, rows[i].id);
      });
      tx();
    }
  }

  // Purge archived > 30 days
  const purged = db.prepare("SELECT id, md_path, fts_rowid FROM memory_meta WHERE category='archived' AND created_at < datetime('now', '-30 days')").all();
  if (purged.length) {
    const t = db.transaction(() => {
      for (const p of purged) {
        db.prepare('DELETE FROM memory_fts WHERE rowid=?').run(p.fts_rowid);
        db.prepare('DELETE FROM memory_meta WHERE id=?').run(p.id);
      }
    });
    t();
  }
  return { archived: archived.length, purged: purged.length };
}

// ── Main ──
async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const hi = JSON.parse(input);
    const cwd = hi.cwd || process.env.MYMORE_CWD;
    debug('hookInput:', { transcriptPath: hi.transcript_path, cwd });
    if (cwd) process.env.MYMORE_CWD = cwd;
    const groupId = getGroupId(cwd);
    const dbPath = getDbPath();

    // ── Step 1: Auto-save raw conversation ──
    if (hi.transcript_path && existsSync(hi.transcript_path)) {
      let lines = [];
      for (let a = 1; a <= 5; a++) {
        const c = readFileSync(hi.transcript_path, 'utf8');
        lines = c.trim().split('\n');
        try { const l = JSON.parse(lines[lines.length - 1]); if (l.type === 'system' && l.subtype === 'turn_duration') break; } catch {}
        debug(`retry ${a}: waiting for turn_duration`);
        await new Promise(r => setTimeout(r, 100));
      }

      const turn = extractLastTurn(lines);
      debug('extracted:', { userLen: turn.user?.length || 0, assistantLen: turn.assistant?.length || 0 });

      if (hasContent(turn.user) || hasContent(turn.assistant)) {
        const db = openDb();
        const now = new Date().toISOString();
        const results = [];

        for (const item of [
          { content: turn.user, role: 'user', track: 'user', ownerId: 'dante926' },
          { content: turn.assistant, role: 'assistant', track: 'agent', ownerId: 'claude' },
        ]) {
          if (item.content && hasContent(item.content)) {
            const entry = {
              id: randomUUID(), track: item.track, owner_id: item.ownerId,
              category: 'session', content: item.content, created_at: now, group_key: groupId,
            };
            const id = appendToFts5(db, groupId, item.content, entry);
            appendToGroupMd({ ...entry, id });
            results.push(item.role);
          }
        }
        db.close();
        debug('saved:', results);
        process.stdout.write(JSON.stringify({ systemMessage: `💾 mymore: Saved ${results.length} turn(s) [raw]` }));
      }
    }

    // ── Step 2: Run consolidate ──
    if (existsSync(dbPath)) {
      const db = openDb();
      const stat = runConsolidate(db);
      db.close();
      debug('consolidated:', stat);
    }

    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    process.exit(0);
  }
}

main();
