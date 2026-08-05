import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { recordConversation, readConversationMessages } from '../src/conversation/l0-recorder.js';

function dateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('L0 recorder', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l0-test-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes one JSONL line per message, filtered by sessionKey', async () => {
    const recs = await recordConversation({
      sessionKey: 'projA', baseDir: dir,
      messages: [
        { role: 'user', content: '我们选方案B要手动调skill吗?', timestamp: 1000 },
        { role: 'assistant', content: '不需要, 有always-on skill', timestamp: 2000 },
      ],
    });
    expect(recs).toHaveLength(2);
    const raw = readFileSync(join(dir, 'conversations', `${dateStr()}.jsonl`), 'utf-8');
    expect(raw.split('\n').filter(Boolean)).toHaveLength(2);
    expect(JSON.parse(raw.split('\n')[0]).sessionKey).toBe('projA');
  });

  it('filters by afterTimestamp (incremental)', async () => {
    await recordConversation({
      sessionKey: 'projA', baseDir: dir,
      messages: [{ role: 'user', content: '第二轮', timestamp: 3000 }],
      afterTimestamp: 2000,
    });
    const msgs = await readConversationMessages('projA', dir);
    expect(msgs.map(m => m.timestamp)).toEqual([1000, 2000, 3000]);
    const inc = await recordConversation({
      sessionKey: 'projA', baseDir: dir,
      messages: [{ role: 'user', content: '第三轮', timestamp: 4000 }],
      afterTimestamp: 3000,
    });
    expect(inc).toHaveLength(1);
    expect(inc[0].timestamp).toBe(4000);
  });

  it('replaces polluted user content with originalUserText', async () => {
    const recs = await recordConversation({
      sessionKey: 'projB', baseDir: dir,
      messages: [{ role: 'user', content: '<system_reminder>polluted</system_reminder> 真实问题', timestamp: 1000 }],
      originalUserText: '真实问题',
    });
    expect(recs[0].content).toBe('真实问题');
  });

  it('strips base64 image data URIs', async () => {
    const recs = await recordConversation({
      sessionKey: 'projC', baseDir: dir,
      messages: [{ role: 'assistant', content: '图: data:image/png;base64,iVBORw0KGgoAAAANSUhEUg== 说明', timestamp: 1000 }],
    });
    expect(recs[0].content).toContain('[image]');
  });
});
