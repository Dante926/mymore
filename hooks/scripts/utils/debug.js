#!/usr/bin/env node

/**
 * mymore Hooks — Debug Logger
 *
 * When MYMORE_DEBUG=1, writes ISO-timestamped log lines to /tmp/mymore-debug.log.
 * Silent when MYMORE_DEBUG is not set.
 */

import { appendFileSync } from 'fs';

const DEBUG = process.env.MYMORE_DEBUG === '1';
const LOG_FILE = '/tmp/mymore-debug.log';

let prefix = 'hooks';

export function setDebugPrefix(p) {
  prefix = p;
}

export function debug(...args) {
  if (!DEBUG) return;
  try {
    const timestamp = new Date().toISOString();
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    appendFileSync(LOG_FILE, `[${timestamp}] [${prefix}] ${message}\n`);
  } catch {
    // Silent — debug should never throw
  }
}
