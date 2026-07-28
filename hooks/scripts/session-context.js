#!/usr/bin/env node

/**
 * mymore — SessionStart Hook
 *
 * Loads recent memories and last session summary for the project.
 * Injects <session-context> into Claude's system prompt.
 *
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 * Never blocks the user — silences all errors.
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { readFileSync, existsSync } from 'fs';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getDbPath, getSessionFilePath, createStorage } from './utils/config.js';

setDebugPrefix('session-start');

const RECENT_COUNT = 5;

function formatRelativeTime(isoTime) {
  const now = Date.now();
  const then = new Date(isoTime).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    const hookInput = JSON.parse(input || '{}');
    const cwd = hookInput.cwd || process.env.MYMORE_CWD;
    debug('hookInput:', { cwd });

    if (cwd) process.env.MYMORE_CWD = cwd;
    const groupId = getGroupId(cwd);
    const dbPath = getDbPath();
    const sessionFile = getSessionFilePath();

    if (!existsSync(dbPath)) {
      debug('no db yet, skipping');
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    let recentMemories = [];
    try {
      const storage = createStorage();
      const results = storage.search(null, {
        group_key: groupId,
        limit: 100,
      });
      // Filter to persistent + session, sort by recency, take top RECENT_COUNT
      recentMemories = results
        .filter(m => m.category === 'persistent' || m.category === 'session')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, RECENT_COUNT);
      debug('recent memories:', recentMemories.length);
    } catch (e) {
      debug('db query error:', e.message);
    }

    // Read last session summary
    let lastSession = null;
    try {
      if (existsSync(sessionFile)) {
        const content = readFileSync(sessionFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          const entry = JSON.parse(lines[i]);
          if (entry.groupId === groupId) {
            lastSession = entry;
            break;
          }
        }
      }
    } catch (e) {
      debug('session file error:', e.message);
    }

    if (recentMemories.length === 0 && !lastSession) {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    // Count session-type (raw) entries pending reflection
    const rawCount = recentMemories.filter(m => m.category === 'session').length;
    const contextParts = [];
    if (rawCount > 0) {
      contextParts.push(`Note: ${rawCount} raw episode(s) pending reflection (auto-expire in 1h).`);
    }
    if (lastSession) {
      const timeAgo = formatRelativeTime(lastSession.timestamp);
      contextParts.push(`Last session (${timeAgo}, ${lastSession.turnCount} turns): ${lastSession.summary}`);
    }
    if (recentMemories.length > 0) {
      const lines = recentMemories.map((m, i) => {
        const date = new Date(m.created_at).toLocaleDateString();
        return `[${i + 1}] (${date}) ${m.content.slice(0, 120)}`;
      }).join('\n\n---\n\n');
      contextParts.push(`Recent memories (${recentMemories.length}):\n\n${lines}`);
    }

    const contextMessage = `<session-context>\n${contextParts.join('\n\n')}\n</session-context>`;

    let displayOutput;
    if (lastSession) {
      const truncated = lastSession.summary.length > 40
        ? lastSession.summary.slice(0, 40) + '...'
        : lastSession.summary;
      const timeAgo = formatRelativeTime(lastSession.timestamp);
      displayOutput = `💡 mymore: Last (${timeAgo}, ${lastSession.turnCount} turns): "${truncated}"`;
      if (recentMemories.length > 0) displayOutput += ` | ${recentMemories.length} memories`;
    } else if (recentMemories.length > 0) {
      displayOutput = `💡 mymore: ${recentMemories.length} memories loaded`;
    } else {
      displayOutput = `💡 mymore: Ready`;
    }
    if (rawCount > 0) {
      displayOutput += ` | ${rawCount} raw pending`;
    }

    console.log(JSON.stringify({ continue: true, systemMessage: displayOutput, systemPrompt: contextMessage }));
    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

main();
