import { describe, it, expect } from 'vitest';
import { SceneExtractor } from '../src/scene/scene-extractor.js';
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
});
