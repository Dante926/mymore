#!/usr/bin/env node

/**
 * mymore — Stop Hook
 *
 * Runs consolidate maintenance: archive expired entries, purge old data.
 * Memory storage is done exclusively through MCP `add_memory`.
 */

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

import { debug, setDebugPrefix } from './utils/debug.js';
import { getGroupId, createConsolidator } from './utils/config.js';

setDebugPrefix('store');

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const hi = JSON.parse(input || '{}');
    if (hi.cwd) process.env.MYMORE_CWD = hi.cwd;

    const consolidator = createConsolidator();
    const summary = await consolidator.run({
      days: 1,
      dry_run: false,
      retention_days: 30,
    });

    debug('consolidation done:', summary);
    process.exit(0);
  } catch (e) {
    debug('error:', e.message);
    process.exit(0);
  }
}

main();
