#!/usr/bin/env node

/**
 * mymore — SessionEnd Hook
 *
 * Extracts the first user prompt from the transcript as a session summary,
 * appends it to the local sessions log (sessions.jsonl), then notifies the
 * mcp-server so it can flush pending L0 increments (spec §3.1 SessionEnd role).
 *
 * Pure sensor: no LLM, no SQLite, never blocks the user.
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 * Errors are logged (structured) and always answered with {continue:true} —
 * never swallowed, never allowed to kill the hook (final review I2).
 */

import { readFileSync, existsSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, getSessionFilePath, ensureDataDir } from './utils/config.js';
import { notifyServer, logError } from './utils/l0-sensor.js';

setDebugPrefix('session-end');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  const hookInput = JSON.parse(input || '{}');
  const transcriptPath = hookInput.transcript_path;
  const sessionKey = hookInput.session_id || hookInput.cwd || 'default';
  debug('hookInput:', { transcriptPath, cwd: hookInput.cwd });

  if (hookInput.cwd) process.env.MYMORE_CWD = hookInput.cwd;
  const groupId = getGroupId(hookInput.cwd);

  let firstPrompt = '';
  let turnCount = 0;

  if (transcriptPath && existsSync(transcriptPath)) {
    const content = readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Extract first user prompt as summary.
    // Malformed lines are tolerated per-line (counted + logged once, not silent).
    let skippedLines = 0;
    for (let i = 0; i < lines.length; i++) {
      let e;
      try {
        e = JSON.parse(lines[i]);
      } catch {
        skippedLines++;
        continue;
      }
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
    }
    if (skippedLines > 0) debug('skipped malformed transcript lines:', skippedLines);
  } else {
    debug('no transcript, skipping summary extraction');
  }

  if (firstPrompt) {
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
  } else {
    debug('no prompt found, skipping summary write');
  }

  // SessionEnd 角色 (spec §3.1)：flush 未落盘增量 + 触发兜底调度。
  // fire-and-forget 通知 mcp-server，server 侧 PipelineManager 在 SIGTERM 时 flush；
  // 这里在 SessionEnd 再通知一次，让 server 尽快处理 pending。网络失败静默（sensor 契约）。
  notifyServer(sessionKey);

  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  logError('SessionEnd', err, { stage: 'main' });
  process.stdout.write(JSON.stringify({ continue: true }));
});
