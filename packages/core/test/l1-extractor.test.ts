import { describe, it, expect } from 'vitest';
import { extractL1Memories } from '../src/record/l1-extractor.js';
import { LLMRunner } from '../src/llm.js';

describe('L1 extractor', () => {
  const fakeLlm = (output: string) => ({
    run: async () => output,
  }) as unknown as LLMRunner;

  it('extracts structured memories from messages', async () => {
    const messages = [
      { id: 'm1', role: 'user' as const, content: '用户：我更喜欢暗色模式', timestamp: 1000 },
      { id: 'm2', role: 'assistant' as const, content: '好的', timestamp: 2000 },
    ];
    const llm = fakeLlm(JSON.stringify([
      { scene_name: '聊偏好', message_ids: ['m1'], memories: [
        { content: '用户喜欢暗色模式', type: 'persona', priority: 85, source_message_ids: ['m1'], metadata: {} },
      ] },
    ]));
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.success).toBe(true);
    expect(result.extractedCount).toBe(1);
    expect(result.records[0].type).toBe('persona');
    expect(result.records[0].content).toBe('用户喜欢暗色模式');
  });

  it('tolerates code-fenced JSON', async () => {
    const messages = [{ id: 'm1', role: 'user' as const, content: 'x', timestamp: 1 }];
    const llm = fakeLlm('```json\n' + JSON.stringify([{ scene_name: 's', message_ids: [], memories: [] }]) + '\n```');
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.success).toBe(true);
    expect(result.sceneNames).toEqual(['s']);
  });

  it('extracts first array despite trailing bracket-bearing text', async () => {
    const messages = [{ id: 'm1', role: 'user' as const, content: 'x', timestamp: 1 }];
    const llm = fakeLlm(
      JSON.stringify([{ scene_name: 's', message_ids: ['m1'], memories: [
        { content: 'c', type: 'persona', priority: 80, source_message_ids: ['m1'], metadata: {} },
      ] }]) +
        '\n以下是补充说明 [备注1] [备注2]（含方括号的尾部文本）',
    );
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.success).toBe(true);
    expect(result.sceneNames).toEqual(['s']);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].content).toBe('c');
  });

  it('repairs bare identifier priority and trailing comma', async () => {
    const messages = [{ id: 'm1', role: 'user' as const, content: 'x', timestamp: 1 }];
    const llm = fakeLlm('[{"scene_name":"s","message_ids":[],"memories":[{"content":"c","type":"persona","priority": sheet,"source_message_ids":[],"metadata":{}},]}]');
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.success).toBe(true);
    expect(result.records[0].priority).toBe(50); // repaired default
  });

  it('normalizes legacy type names', async () => {
    const messages = [{ id: 'm1', role: 'user' as const, content: 'x', timestamp: 1 }];
    const llm = fakeLlm(JSON.stringify([{ scene_name: 's', message_ids: [], memories: [
      { content: 'c', type: 'preference', priority: 80, source_message_ids: [], metadata: {} },
    ] }]));
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.records[0].type).toBe('persona'); // preference → persona
  });

  it('skips invalid type names', async () => {
    const messages = [{ id: 'm1', role: 'user' as const, content: 'x', timestamp: 1 }];
    const llm = fakeLlm(JSON.stringify([{ scene_name: 's', message_ids: [], memories: [
      { content: 'c', type: 'bogus', priority: 80, source_message_ids: [], metadata: {} },
    ] }]));
    const result = await extractL1Memories({ messages, llm, baseDir: '/tmp/x', sessionKey: 's' });
    expect(result.records).toHaveLength(0);
  });
});
