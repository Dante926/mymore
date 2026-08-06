/**
 * mymore — L0 Sensor (shared hook helper)
 *
 * Hooks are pure sensors: they write L0 JSONL increments via @mymore/core and
 * fire-and-forget an HTTP notify to the pipeline. They never touch SQLite and
 * never block the user.
 */

import { recordConversation } from '@mymore/core';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const NOTIFY_URL = 'http://127.0.0.1:3477/notify';
const LOG_FILE = '/tmp/mymore-hooks.jsonl';

/**
 * Structured error log — writes one JSON line to /tmp/mymore-hooks.jsonl.
 * Never throws (logging must not take the hook down).
 */
export function logError(hook, err, extra = {}) {
  try {
    mkdirSync('/tmp', { recursive: true });
    appendFileSync(
      LOG_FILE,
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        hook,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
        ...extra,
      }) + '\n',
      'utf-8',
    );
  } catch {
    // never throw from a logger
  }
}

/** Fire-and-forget HTTP notify to the L0→L1 pipeline. Never throws. */
export function notifyServer(sessionKey) {
  const payload = JSON.stringify({ sessionKey });
  // fire-and-forget: no await, swallow network errors
  fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(() => {});
}

/** Extract plain text from a single content block: string or {type:'text',text}[] */
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }
  return '';
}

/**
 * Tier 0 — internal / non-human-input signals that should never be recorded,
 * even if they contain free-form text. Covers: NO_REPLY-style continuations,
 * slash commands, task notifications, local-command echo, and skill dumps.
 *
 * Note: harness tags like <system_reminder>/<additional_data> are NOT Tier-0'd
 * outright — a real question may sit next to them. They are stripped at Tier 2,
 * and if nothing remains the turn is skipped.
 */
function isInternalNoise(text) {
  if (/^(NO_REPLY|continue|继续)\s*$/i.test(text)) return true;
  if (/^\s*\/[a-zA-Z]/.test(text)) return true; // slash command (/effort, /help …)
  if (/<command-message>/i.test(text)) return true; // slash command wrapper
  if (/<task-notification>/i.test(text)) return true; // subagent task notifications
  if (/<local-command-caveat>|<local-command-stdout>/i.test(text)) return true; // local-command echo
  if (/Base directory for this skill:/i.test(text) && /<SUBAGENT-STOP>/i.test(text)) return true; // skill dump
  return false;
}

/**
 * Strip known harness tags / blocks, leaving only the core text.
 * Tier 2. Removes:
 *  - <system_reminder> / <system-reminder> blocks
 *  - <additional_data> / <additional-data> blocks
 *  - <user_info> blocks
 *  - <local-command-stdout> / <local-command-caveat> blocks
 *  - <command-message> / <command-name> / <command-args> blocks
 *  - ISO-8601 timestamps
 *  - tool-echo lines (e.g. "File created successfully at: ...")
 */
function stripHarnessTags(text) {
  let t = text;
  const blockTags = [
    'system-reminder',
    'system_reminder',
    'additional-data',
    'additional_data',
    'user_info',
    'local-command-stdout',
    'local-command-caveat',
    'command-message',
    'command-name',
    'command-args',
  ];
  for (const tag of blockTags) {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
    t = t.replace(re, ' ');
  }
  // ISO timestamps
  t = t.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g, ' ');
  // tool-echo: "File created successfully at: ..."
  t = t.replace(/^[ \t]*File (?:created|written|updated) successfully at:[^\n]*$/gim, ' ');
  return t;
}

/**
 * Extract the real user question from a hook prompt.
 *
 * 3-tier cleaning (spec §3.2 L0 清洗):
 *  - Tier 0: internal/system patterns → null (don't record this turn)
 *  - Tier 1: extract the <user_query> block content if present
 *  - Tier 2: strip known harness tags + timestamps + tool echo
 *
 * Returns cleaned string, or null when there is no real human question.
 */
export function stripHarnessNoise(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const original = prompt;

  // Tier 1 — <user_query> block content is authoritative if present
  const userQueryMatch = original.match(/<user_query>([\s\S]*?)<\/user_query>/i);
  if (userQueryMatch) {
    const cleaned = stripHarnessTags(userQueryMatch[1]).trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  // Tier 0 — pure internal/system patterns (no user intent)
  if (isInternalNoise(original)) return null;

  // Tier 2 — strip harness tags
  const stripped = stripHarnessTags(original).trim();
  if (stripped.length === 0) return null;
  return stripped;
}

/**
 * UserPromptSubmit sensor: record the user's real question to L0, then notify.
 * If the prompt is pure harness noise → skip entirely (no L0 write, no notify).
 */
export async function recordUserPrompt({ baseDir, sessionKey, prompt, cwd }) {
  try {
    const cleaned = stripHarnessNoise(prompt);
    if (cleaned === null) return;
    await recordConversation({
      sessionKey,
      messages: [{ role: 'user', content: cleaned }],
      baseDir,
      originalUserText: cleaned,
    });
    notifyServer(sessionKey);
  } catch (err) {
    logError('UserPromptSubmit', err, { sessionKey, cwd });
  }
}

/**
 * Stop sensor: read the transcript, extract the last assistant plain-text reply
 * (skipping tool_use/thinking), append to L0 with an afterTimestamp cursor,
 * then notify.
 */
export async function recordStopIncrement({ baseDir, sessionKey, transcriptPath, cwd, afterTimestamp }) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return;
    const raw = readFileSync(transcriptPath, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim());

    // Walk backwards: find the last line that yields a plain-text assistant reply.
    // Rejects assistant lines whose content is entirely tool_use/thinking, and
    // rejects messages that reference tool_use_id (tool results).
    let picked = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      let rec;
      try {
        rec = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (rec.type !== 'assistant' && rec.message?.role !== 'assistant') continue;
      const content = rec.message?.content ?? rec.content;
      if (Array.isArray(content) && content.some((p) => p && p.type === 'tool_use_id')) continue;
      const text = extractText(content).trim();
      if (!text) continue;
      picked = { text, ts: typeof rec.timestamp === 'number' ? rec.timestamp : Date.now() };
      break;
    }
    if (!picked) return;

    await recordConversation({
      sessionKey,
      messages: [{ role: 'assistant', content: picked.text, timestamp: picked.ts }],
      baseDir,
      afterTimestamp,
    });
    notifyServer(sessionKey);
  } catch (err) {
    logError('Stop', err, { sessionKey, transcriptPath, cwd });
  }
}

/** Ensure the L0 base dir exists (used by hook entry points before writing). */
export function ensureBaseDir(baseDir) {
  try {
    mkdirSync(join(baseDir, 'conversations'), { recursive: true });
  } catch {
    // never throw
  }
}
