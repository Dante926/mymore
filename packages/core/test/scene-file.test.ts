import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseSceneFile, serializeSceneFile, sanitizeSceneName, syncSceneIndex } from '../src/scene/scene-file.js';
import type { SceneFile } from '../src/scene/scene-file.js';

describe('scene-file', () => {
  it('parses META + body', () => {
    const raw = `-----META-START-----\ncreated: 2026-08-01\nupdated: 2026-08-05\nsummary: 30-40 words summary here\nheat: 3\n-----META-END-----\n\n## 核心叙事\nTrigger -> Action -> Result`;
    const scene = parseSceneFile(raw)!;
    expect(scene.meta.heat).toBe(3);
    expect(scene.body).toContain('核心叙事');
  });

  it('round-trips serialize → parse', () => {
    const scene: SceneFile = { path: 'x.md', meta: { created: 'a', updated: 'b', summary: 's', heat: 1 }, body: '# body' };
    const reparsed = parseSceneFile(serializeSceneFile(scene))!;
    expect(reparsed.meta.heat).toBe(1);
    expect(reparsed.body).toBe('# body');
  });

  it('sanitizes scene names', () => {
    expect(sanitizeSceneName('我（AI）在和 用户 做 改造 设计')).toMatch(/^[a-zA-Z0-9一-鿿_-]+$/);
  });

  it('syncSceneIndex scans and writes index', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scene-'));
    writeFileSync(join(dir, 'a.md'), `-----META-START-----\ncreated: 2026-08-01\nupdated: 2026-08-05\nsummary: x\nheat: 2\n-----META-END-----\n# a`);
    const idx = syncSceneIndex(dir);
    expect(idx).toHaveLength(1);
    expect(idx[0].path).toBe('a.md');
    // scene_index.json written
    expect(existsSync(join(dir, 'scene_index.json'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
