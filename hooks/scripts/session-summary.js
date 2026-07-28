#!/usr/bin/env node

/**
 * mymore — SessionEnd Hook
 *
 * Extracts the first user prompt from the transcript as a session summary,
 * appends it to the local sessions log (data/sessions.jsonl).
 *
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 * Never blocks the user — silences all errors.
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { readFileSync, existsSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getSessionFilePath, ensureDataDir } from './utils/config.js';

setDebugPrefix('session-end');

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    const hookInput = JSON.parse(input || '{}');
    const transcriptPath = hookInput.transcript_path;
    debug('hookInput:', { transcriptPath, cwd: hookInput.cwd });

    if (hookInput.cwd) process.env.MYMORE_CWD = hookInput.cwd;
    const groupId = getGroupId(hookInput.cwd);

    if (!transcriptPath || !existsSync(transcriptPath)) {
      debug('no transcript, skipping');
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const content = readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Extract first user prompt as summary
    let firstPrompt = '';
    let turnCount = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const e = JSON.parse(lines[i]);
        if (e.type === 'system' && e.subtype === 'turn_duration') {
          turnCount++;
          continue;
        }
        if (e.type === 'user' && !firstPrompt) {
          const msg = e.message?.content;
          if (typeof msg === 'string') {
            firstPrompt = msg.slice(0, 200);
          } else if (Array.isArray(msg)) {
            for (const block of msg) {
              if (block.type === 'text' && block.text) {
                firstPrompt = block.text.slice(0, 200);
                break;
              }
            }
          }
        }
      } catch {}
    }

    if (!firstPrompt) {
      debug('no prompt found');
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    // Save to sessions log
    const sessionEntry = JSON.stringify({
      sessionId: hookInput.session_id || randomUUID(),
      groupId,
      summary: firstPrompt,
      turnCount: turnCount + 1,
      timestamp: new Date().toISOString(),
    });

    ensureDataDir();
    appendFileSync(getSessionFilePath(), sessionEntry + '\n');

    debug('saved:', { groupId, summary: firstPrompt.slice(0, 50), turnCount: turnCount + 1 });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

main();
