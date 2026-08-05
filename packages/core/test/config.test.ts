import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig } from '../src/config.js';

describe('config', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'cfg-test-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns defaults when no config file', () => {
    const cfg = loadConfig(dir);
    expect(cfg.pipeline.everyNConversations).toBe(5);
    expect(cfg.llm.baseUrl).toBe('');
  });

  it('loads saved config', () => {
    saveConfig({ llm: { baseUrl: 'http://localhost:11434/v1', apiKey: 'k', model: 'qwen' }, pipeline: { everyNConversations: 3, l1IdleTimeoutSeconds: 600, l2DelayAfterL1Seconds: 90, l2MinIntervalSeconds: 900, l2MaxIntervalSeconds: 3600, triggerEveryN: 10 } }, dir);
    const cfg = loadConfig(dir);
    expect(cfg.llm.baseUrl).toBe('http://localhost:11434/v1');
    expect(cfg.pipeline.everyNConversations).toBe(3);
  });

  it('throws on invalid schema', () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ llm: { baseUrl: 123 } }));
    expect(() => loadConfig(dir)).toThrow();
  });
});
