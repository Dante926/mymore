import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setLogDir, setDebugPrefix, debug } from '../scripts/utils/debug.js';

const logPath = (dir) => join(dir, 'logs', `hooks-${new Date().toISOString().slice(0,10)}.jsonl`);
const lastLine = (dir) => JSON.parse(readFileSync(logPath(dir), 'utf-8').trim().split('\n').pop());

describe('hook logging', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hlog-')); setLogDir(dir); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('always writes a JSON line (not gated by MYMORE_DEBUG)', () => {
    setDebugPrefix('test');
    debug('event', { key: 'value' });
    expect(existsSync(logPath(dir))).toBe(true);
    const line = lastLine(dir);
    expect(line.prefix).toBe('test');
    expect(line.message).toBe('event');
    expect(line.data).toEqual({ key: 'value' });
  });

  it('colon-label form (debug("label:", x)) keeps message and leaves data empty', () => {
    setDebugPrefix('test');
    debug('label:', 'value');
    const line = lastLine(dir);
    expect(line.prefix).toBe('test');
    expect(line.message).toBe('label: value');
    expect(line.data).toBeUndefined();
  });

  it('colon-label form renders object args as JSON, never [object Object]', () => {
    setDebugPrefix('test');
    debug('key:', { a: 1 });
    const line = lastLine(dir);
    expect(line.message).toBe('key: {"a":1}');
    expect(line.message).not.toContain('[object Object]');
    expect(line.data).toBeUndefined();
  });

  it('3-arg form (debug(prefix, message, data)) sets prefix/message/data', () => {
    setDebugPrefix('test');
    debug('p', 'm', { d: 1 });
    const line = lastLine(dir);
    expect(line.prefix).toBe('p');
    expect(line.message).toBe('m');
    expect(line.data).toEqual({ d: 1 });
  });

  it('2-arg no-colon with non-object second arg keeps both args', () => {
    setDebugPrefix('test');
    debug('a', 'b');
    const line = lastLine(dir);
    expect(line.prefix).toBe('test');
    expect(line.message).toBe('a b');
    expect(line.data).toBeUndefined();
  });

  it('never throws on circular or BigInt payloads (colon-label + data)', () => {
    setDebugPrefix('test');
    const circular = { name: 'loop' };
    circular.self = circular;
    // colon-label + circular object -> falls back to String, no throw
    expect(() => debug('session:', circular)).not.toThrow();
    expect(lastLine(dir).message).toBe('session: [object Object]');
    // colon-label + BigInt -> JSON.stringify throws, falls back to String, no throw
    expect(() => debug('count:', { n: 10n })).not.toThrow();
    expect(lastLine(dir).message).toBe('count: [object Object]');
    // (message, object-data) + circular/BigInt data -> whole line dropped, no throw
    expect(() => debug('event', { n: 10n })).not.toThrow();
    expect(() => debug('event', circular)).not.toThrow();
    // a line was still written afterwards (logger alive)
    expect(() => debug('alive', { ok: true })).not.toThrow();
    expect(lastLine(dir).data).toEqual({ ok: true });
  });
});
