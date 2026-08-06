#!/usr/bin/env node

/**
 * mymore Hooks — Debug Logger
 *
 * Two outputs, independent of each other:
 *
 * 1. Structured JSONL — ALWAYS on. Every hook event (start/end/error) is
 *    appended as one JSON line to `${logDir}/logs/hooks-YYYY-MM-DD.jsonl`
 *    (default logDir is `~/.mymore`), regardless of MYMORE_DEBUG.
 * 2. Console text log — only when MYMORE_DEBUG=1, writes ISO-timestamped
 *    lines to /tmp/mymore-debug.log (legacy behavior, double-logging is fine).
 *
 * Never throws — debug must never take a hook down.
 */

import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEBUG = process.env.MYMORE_DEBUG === '1';
const CONSOLE_LOG_FILE = '/tmp/mymore-debug.log';

let prefix = 'hooks';
let logDir = join(homedir(), '.mymore');

/** Inject the root log directory (defaults to `~/.mymore`). Test-only override. */
export function setLogDir(root) {
  logDir = root;
}

export function setDebugPrefix(p) {
  prefix = p;
}

function normalizeArgs(args) {
  // Support both (message, data?) and (prefix, message, data?) signatures:
  // heuristics below keep existing callers like debug('prompt:', x) working.
  if (args.length === 1) {
    return { prefix, message: String(args[0]) };
  }
  if (args.length >= 3) {
    const data = typeof args[2] === 'object' && args[2] !== null ? args[2] : undefined;
    return { prefix: String(args[0]), message: String(args[1]), data };
  }
  // two args: (prefix, message) when the first is a short label ending in ':',
  // otherwise (message, data).
  if (typeof args[0] === 'string' && /^[\w\s-]+:\s*$/.test(args[0])) {
    return { prefix, message: `${args[0]} ${String(args[1])}` };
  }
  const data = typeof args[1] === 'object' && args[1] !== null ? args[1] : undefined;
  return { prefix, message: String(args[0]), data };
}

/** Structured JSONL line — always written, independent of MYMORE_DEBUG. */
function appendStructuredLog({ prefix: p, message, data }) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const logFile = join(logDir, 'logs', `hooks-${day}.jsonl`);
    mkdirSync(join(logDir, 'logs'), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      prefix: p,
      message,
    };
    if (data !== undefined) entry.data = data;
    appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Silent — debug should never throw
  }
}

/** Legacy console debug line — only when MYMORE_DEBUG=1. */
function appendConsoleLog({ prefix: p, message, data }) {
  try {
    const timestamp = new Date().toISOString();
    const dataText = data === undefined ? '' : ` ${JSON.stringify(data)}`;
    appendFileSync(CONSOLE_LOG_FILE, `[${timestamp}] [${p}] ${message}${dataText}\n`);
  } catch {
    // Silent — debug should never throw
  }
}

export function debug(...args) {
  const entry = normalizeArgs(args);
  // Always: structured JSONL to ~/.mymore/logs/hooks-YYYY-MM-DD.jsonl
  appendStructuredLog(entry);
  // When MYMORE_DEBUG=1: legacy console line too
  if (DEBUG) appendConsoleLog(entry);
}
