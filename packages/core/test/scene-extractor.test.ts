import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SceneExtractor, parseSceneDecision } from '../src/scene/scene-extractor.js';
import { parseSceneFile, serializeSceneFile, syncSceneIndex } from '../src/scene/scene-file.js';
import type { SceneFile } from '../src/scene/scene-file.js';
import { LLMRunner } from '../src/llm.js';

describe('SceneExtractor', () => {
  const fakeLlm = (output: string) => ({ run: async () => output }) as unknown as LLMRunner;

  it('UPDATE existing scene with new record content', async () => {
    const llm = fakeLlm(JSON.stringify({ action: 'update', target_path: 'a.md', content: '## 核心叙事\nTrigger -> 部署 v2 -> Result', summary: '用户部署 v2', heat: 4, deleted_paths: [], request_persona_update: false }));
    const extractor = new SceneExtractor({ llm, scenesDir: '/tmp/scenes' });
    const result = await extractor.extractL2({ newRecords: [], existingScenes: [{ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 'old', heat: 3 }, body: 'old' }], lastSceneIndex: [] });
    expect(result.action).toBe('update');
    expect(result.targetPath).toBe('a.md');
    expect(result.heat).toBe(4);
  });

  it('CREATE new scene when no match', async () => {
    const llm = fakeLlm(JSON.stringify({ action: 'create', scene_name: '部署 v2', content: '## 核心叙事\nTrigger -> 部署 -> Result', summary: '新场景', heat: 1, deleted_paths: [], request_persona_update: false }));
    const extractor = new SceneExtractor({ llm, scenesDir: '/tmp/scenes' });
    const result = await extractor.extractL2({ newRecords: [], existingScenes: [], lastSceneIndex: [] });
    expect(result.action).toBe('create');
    expect(result.newSceneName).toBe('部署 v2');
  });

  it('MERGE marks old scene [DELETED]', async () => {
    const llm = fakeLlm(JSON.stringify({ action: 'merge', target_path: 'a.md', content: 'merged', summary: '合并', heat: 5, deleted_paths: ['b.md'], request_persona_update: true }));
    const extractor = new SceneExtractor({ llm, scenesDir: '/tmp/scenes' });
    const result = await extractor.extractL2({ newRecords: [], existingScenes: [{ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 'x', heat: 2 }, body: 'x' }], lastSceneIndex: [] });
    expect(result.action).toBe('merge');
    expect(result.deletedPaths).toContain('b.md');
    expect(result.personaUpdateRequested).toBe(true);
  });

  // ---- Round-1 review regression tests ----

  it('merge heat fallback = sum(all related) + 1 (no LLM heat)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'l2-merge-heat-'));
    const mk = (name: string, heat: number, body: string) =>
      writeFileSync(join(dir, name), serializeSceneFile({ path: name, meta: { created: 'a', updated: 'b', summary: 's', heat }, body }));
    mk('a.md', 2, '## A');
    mk('b.md', 3, '## B');
    const sceneOf = (name: string): SceneFile => {
      const p = parseSceneFile(readFileSync(join(dir, name), 'utf8'))!;
      return { path: name, meta: p.meta, body: p.body };
    };
    // LLM 未给 heat（合法 JSON 但字段缺失/非数字）→ 工程侧兜底：target(2) + deleted(3) + 1 = 6
    const llm = fakeLlm(JSON.stringify({ action: 'merge', target_path: 'a.md', content: '## merged\nA+B', summary: 'm', deleted_paths: ['b.md'], request_persona_update: false }));
    const extractor = new SceneExtractor({ llm, scenesDir: dir });
    const result = await extractor.extractL2({ newRecords: [], existingScenes: [sceneOf('a.md'), sceneOf('b.md')], lastSceneIndex: [] });
    expect(result.heat).toBe(6);
    expect(parseSceneFile(readFileSync(join(dir, 'a.md'), 'utf8'))!.meta.heat).toBe(6);
    rmSync(dir, { recursive: true, force: true });
  });

  it('parse failure throws instead of overwriting an existing scene', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'l2-parse-fail-'));
    writeFileSync(join(dir, 'a.md'), serializeSceneFile({ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 'orig', heat: 2 }, body: '## 原有叙事' }));
    const original = readFileSync(join(dir, 'a.md'), 'utf8');
    const existing: SceneFile[] = [{
      path: 'a.md',
      meta: { created: 'a', updated: 'b', summary: 'orig', heat: 2 },
      body: '## 原有叙事',
    }];
    const llm = fakeLlm('完全不是 JSON 的输出文本，没有任何对象');
    const extractor = new SceneExtractor({ llm, scenesDir: dir });
    await expect(extractor.extractL2({ newRecords: [], existingScenes: existing, lastSceneIndex: [] })).rejects.toThrow();
    // 文件未被覆盖，无 [空白场景] 占位，索引未被动过
    expect(readFileSync(join(dir, 'a.md'), 'utf8')).toBe(original);
    expect(readFileSync(join(dir, 'a.md'), 'utf8')).not.toContain('[空白场景]');
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects path escaping the scenes dir (target_path ../)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'l2-escape-'));
    const llm = fakeLlm(JSON.stringify({ action: 'update', target_path: '../escaped.md', content: 'evil', summary: 'x', heat: 2, deleted_paths: [], request_persona_update: false }));
    const extractor = new SceneExtractor({ llm, scenesDir: dir });
    const existing: SceneFile[] = [{ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 's', heat: 1 }, body: '## A' }];
    await expect(extractor.extractL2({ newRecords: [], existingScenes: existing, lastSceneIndex: [] })).rejects.toThrow(/逃逸/);
    expect(existsSync(join(dir, '..', 'escaped.md'))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects path escaping the scenes dir (deleted_paths nested traversal)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'l2-escape-del-'));
    writeFileSync(join(dir, 'a.md'), serializeSceneFile({ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 's', heat: 1 }, body: '## A' }));
    const llm = fakeLlm(JSON.stringify({ action: 'merge', target_path: 'a.md', content: 'm', summary: 'x', heat: 2, deleted_paths: ['sub/../../b.md'], request_persona_update: false }));
    const extractor = new SceneExtractor({ llm, scenesDir: dir });
    const existing: SceneFile[] = [{ path: 'a.md', meta: { created: 'a', updated: 'b', summary: 's', heat: 1 }, body: '## A' }];
    await expect(extractor.extractL2({ newRecords: [], existingScenes: existing, lastSceneIndex: [] })).rejects.toThrow(/逃逸/);
    expect(existsSync(join(dir, 'a.md'))).toBe(true); // target 未被写（先软删循环里就抛了）
    expect(existsSync(join(dir, '..', 'b.md'))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('parseSceneDecision throws on garbage output', () => {
    expect(() => parseSceneDecision('不是 JSON')).toThrow();
    expect(() => parseSceneDecision('[1,2,3]')).toThrow();
    expect(() => parseSceneDecision('')).toThrow();
  });

  it('parseSceneDecision tolerates code fences and trailing text', () => {
    const d = parseSceneDecision('```json\n{"action": "create", "scene_name": "部署 v2", "content": "## 核心叙事", "heat": 1, "deleted_paths": [], "request_persona_update": false}\n```\n说明文字');
    expect(d.action).toBe('create');
    expect(d.scene_name).toBe('部署 v2');
  });
});

