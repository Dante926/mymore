import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadPipelineConfig } from '../src/pipeline-config.js';

describe('loadPipelineConfig (I1: 启动不应因配置损坏而死)', () => {
  const dirs: string[] = [];
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'pcfg-'));
    dirs.push(d);
    return d;
  };
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it('no config.json → core 默认值 (everyN=5, l1Idle=600)，不抛错', () => {
    const cfg = loadPipelineConfig(tmp());
    expect(cfg.everyNConversations).toBe(5);
    expect(cfg.l1IdleTimeoutSeconds).toBe(600);
  });

  it('malformed JSON → 回退默认值，不抛错', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'config.json'), '{"pipeline": 5');
    expect(() => loadPipelineConfig(dir)).not.toThrow();
    const cfg = loadPipelineConfig(dir);
    expect(cfg.everyNConversations).toBe(5);
    expect(cfg.l1IdleTimeoutSeconds).toBe(600);
  });

  it('schema 违规 (pipeline: 5) → 回退默认值，不抛错', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ pipeline: 5 }));
    expect(() => loadPipelineConfig(dir)).not.toThrow();
    const cfg = loadPipelineConfig(dir);
    expect(cfg.everyNConversations).toBe(5);
    expect(cfg.l1IdleTimeoutSeconds).toBe(600);
  });

  it('空文件 → 回退默认值，不抛错', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'config.json'), '');
    expect(() => loadPipelineConfig(dir)).not.toThrow();
    const cfg = loadPipelineConfig(dir);
    expect(cfg.everyNConversations).toBe(5);
    expect(cfg.l1IdleTimeoutSeconds).toBe(600);
  });

  it('合法配置 → 使用配置值', () => {
    const dir = tmp();
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ pipeline: { everyNConversations: 3, l1IdleTimeoutSeconds: 120 } }),
    );
    const cfg = loadPipelineConfig(dir);
    expect(cfg.everyNConversations).toBe(3);
    expect(cfg.l1IdleTimeoutSeconds).toBe(120);
  });
});
