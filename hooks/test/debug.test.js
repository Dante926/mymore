import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setLogDir, setDebugPrefix, debug } from '../scripts/utils/debug.js';

describe('hook logging', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hlog-')); setLogDir(dir); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('always writes a JSON line (not gated by MYMORE_DEBUG)', () => {
    setDebugPrefix('test');
    debug('event', { key: 'value' });
    const logPath = join(dir, 'logs', `hooks-${new Date().toISOString().slice(0,10)}.jsonl`);
    expect(existsSync(logPath)).toBe(true);
    const line = JSON.parse(readFileSync(logPath, 'utf-8').trim().split('\n').pop());
    expect(line.prefix).toBe('test');
    expect(line.message).toBe('event');
    expect(line.data).toEqual({ key: 'value' });
  });
});
