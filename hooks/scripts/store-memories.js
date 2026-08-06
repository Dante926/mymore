#!/usr/bin/env node

/**
 * mymore — Stop Hook (sensor)
 *
 * Reads the transcript, extracts the last assistant plain-text reply, appends
 * it to L0 JSONL with an afterTimestamp cursor, then fire-and-forget notifies
 * the pipeline. Pure sensor: no SQLite, no LLM, never blocks the user.
 *
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 */

import { recordStopIncrement, ensureBaseDir, logError } from './utils/l0-sensor.js';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getRootDir } from './utils/config.js';

setDebugPrefix('store');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  const data = JSON.parse(input || '{}');
  const cwd = data.cwd || process.env.MYMORE_CWD;
  const sessionKey = data.session_id || cwd || 'default';
  const transcriptPath = data.transcript_path || data.transcriptPath || '';

  debug('transcript:', transcriptPath || '(none)');

  ensureBaseDir(getRootDir());
  await recordStopIncrement({
    baseDir: getRootDir(),
    sessionKey,
    transcriptPath,
    cwd,
  });

  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  logError('Stop', err, { stage: 'main' });
  process.stdout.write(JSON.stringify({ continue: true }));
});
