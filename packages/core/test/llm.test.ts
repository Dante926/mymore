import { describe, it, expect, afterEach } from 'vitest';
import { LLMRunner } from '../src/llm.js';

describe('LLMRunner', () => {
  let lastBody: any = null;
  const fakeFetch = async (url: string, init: any) => {
    lastBody = JSON.parse(init.body);
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as unknown as Response;
  };
  afterEach(() => { lastBody = null; });

  it('calls chat/completions with system+user and returns content', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    try {
      const runner = new LLMRunner({ baseUrl: 'http://x', apiKey: 'k', model: 'm' });
      const out = await runner.run({ prompt: '用户问题', systemPrompt: '你是专家', taskId: 'l1-extract' });
      expect(out).toBe('{"ok":true}');
      expect(lastBody.model).toBe('m');
      expect(lastBody.messages).toEqual([
        { role: 'system', content: '你是专家' },
        { role: 'user', content: '用户问题' },
      ]);
    } finally { globalThis.fetch = orig; }
  });

  it('throws on non-2xx with status', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: false, status: 500, statusText: 'ERR', text: async () => 'boom' }) as unknown as Response);
    try {
      const runner = new LLMRunner({ baseUrl: 'http://x', apiKey: 'k', model: 'm' });
      await expect(runner.run({ prompt: 'p', taskId: 't' })).rejects.toThrow('500');
    } finally { globalThis.fetch = orig; }
  });

  it('omits system message when systemPrompt absent', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    try {
      const runner = new LLMRunner({ baseUrl: 'http://x', apiKey: 'k', model: 'm' });
      await runner.run({ prompt: 'p', taskId: 't' });
      expect(lastBody.messages).toHaveLength(1);
      expect(lastBody.messages[0].role).toBe('user');
    } finally { globalThis.fetch = orig; }
  });
});
