#!/usr/bin/env node

/**
 * mymore — UserPromptSubmit Hook (sensor)
 *
 * Records the user's real question (harness noise stripped) to L0 JSONL and
 * fire-and-forget notifies the pipeline. Pure sensor: no SQLite, no LLM, never
 * blocks the user.
 *
 * Hook protocol: reads JSON from stdin, writes JSON to stdout.
 */

import { recordUserPrompt, ensureBaseDir, logError } from './utils/l0-sensor.js';
import { debug, setDebugPrefix } from './utils/debug.js';
import { getRootDir } from './utils/config.js';

setDebugPrefix('inject');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  const data = JSON.parse(input || '{}');
  const cwd = data.cwd || process.env.MYMORE_CWD;
  const sessionKey = data.session_id || cwd || 'default';
  const prompt = data.prompt || '';
  debug('prompt:', prompt.slice(0, 100));

  ensureBaseDir(getRootDir());
  await recordUserPrompt({ baseDir: getRootDir(), sessionKey, prompt, cwd });

  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  logError('UserPromptSubmit', err, { stage: 'main' });
  process.stdout.write(JSON.stringify({ continue: true }));
});
