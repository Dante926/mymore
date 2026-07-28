#!/usr/bin/env node

/**
 * mymore — UserPromptSubmit Hook
 *
 * Searches FTS5 for memories relevant to the user's prompt and injects
 * <relevant-memories> into Claude's context.
 *
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 * Never blocks the user — silences all errors.
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { existsSync } from 'fs';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getDbPath, openDb } from './utils/config.js';

setDebugPrefix('inject');

const MIN_WORDS = 3;
const MAX_MEMORIES = 5;

function countWords(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cjkRegex = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g;
  const cjkMatches = trimmed.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkText = trimmed.replace(cjkRegex, ' ').trim();
  const wordCount = nonCjkText ? nonCjkText.split(/\s+/).filter(w => w.length > 0).length : 0;
  return cjkCount + wordCount;
}

function searchMemories(db, query, groupId, limit) {
  const hasCJK = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/.test(query);
  const useLike = query.length <= 2 && hasCJK;

  if (useLike) {
    return db.prepare(`
      SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
             m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
      FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.group_key = ? AND m.superseded_by IS NULL AND f.content LIKE ?
      ORDER BY m.frozen DESC, m.access_count DESC LIMIT ?
    `).all(groupId, `%${query}%`, limit);
  }

  // Try FTS5 MATCH first
  const results = db.prepare(`
    SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
           m.created_at, m.valid_until, m.superseded_by, m.access_count, rank AS score
    FROM memory_fts f
    JOIN memory_meta m ON f.rowid = m.fts_rowid
    WHERE m.group_key = ? AND m.superseded_by IS NULL AND memory_fts MATCH ?
    ORDER BY m.frozen DESC, rank LIMIT ?
  `).all(groupId, query, limit);

  // Fallback to LIKE for CJK queries
  if (results.length === 0 && hasCJK) {
    return db.prepare(`
      SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,
             m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score
      FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      WHERE m.group_key = ? AND m.superseded_by IS NULL AND f.content LIKE ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(groupId, `%${query}%`, limit);
  }

  return results;
}

function buildDisplayMessage(memories) {
  const header = `📝 mymore Retrieved (${memories.length}):`;
  const lines = [header];
  for (const m of memories) {
    const title = m.content.length > 60 ? m.content.slice(0, 60) + '...' : m.content;
    lines.push(`  • [${m.score.toFixed(2)}] (${new Date(m.created_at).toLocaleDateString()}) ${title}`);
  }
  return lines.join('\n');
}

function buildContext(memories) {
  const lines = [];
  const sorted = [...memories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  lines.push('<relevant-memories>');
  lines.push('The following memories from past sessions are relevant to the user\'s current task:');
  lines.push('');
  lines.push('IMPORTANT: Memories are ordered by recency (most recent first). When there are conflicts or updates between memories, prefer the MORE RECENT information.');
  lines.push('');
  for (const m of sorted) {
    const timeStr = m.created_at
      ? new Date(m.created_at).toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        }) + ' UTC'
      : 'Unknown time';
    lines.push(`[${timeStr}]`);
    lines.push(m.content);
    lines.push('');
  }
  lines.push('Use this context to inform your response. The user has already seen these memories displayed.');
  lines.push('</relevant-memories>');
  return lines.join('\n');
}

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    const data = JSON.parse(input);
    const prompt = data.prompt || '';
    debug('prompt:', prompt.slice(0, 100));

    if (data.cwd) process.env.MYMORE_CWD = data.cwd;
    const groupId = getGroupId(data.cwd);

    if (countWords(prompt) < MIN_WORDS) {
      debug('skipped: prompt too short');
      process.exit(0);
    }

    const dbPath = getDbPath();
    if (!existsSync(dbPath)) {
      debug('skipped: no db');
      process.exit(0);
    }

    const db = openDb();

    let memories = [];
    try {
      const results = searchMemories(db, prompt, groupId, MAX_MEMORIES);
      memories = results;
      debug('search results:', memories.length);
    } catch (e) {
      debug('search error:', e.message);
      db.close();
      process.exit(0);
    }

    if (memories.length === 0) {
      debug('no relevant memories');
      db.close();
      process.exit(0);
    }

    const displayMessage = buildDisplayMessage(memories);
    const context = buildContext(memories);

    const output = {
      systemMessage: displayMessage,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context,
      },
    };

    debug('output:', { memories: memories.length });
    process.stdout.write(JSON.stringify(output));
    db.close();
    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    process.exit(0);
  }
}

main();
