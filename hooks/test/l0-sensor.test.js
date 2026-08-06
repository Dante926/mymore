import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  recordUserPrompt,
  recordStopIncrement,
  stripHarnessNoise,
} from '../scripts/utils/l0-sensor.js';

const dayFile = () => join(dayDir(), `${new Date().toISOString().slice(0, 10)}.jsonl`);
const dayDir = () => join(globalThis.__dir, 'conversations');
const readLines = () => (existsSync(dayFile()) ? readFileSync(dayFile(), 'utf-8').split('\n').filter(Boolean) : []);

describe('l0-sensor', () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'l0sensor-'));
    globalThis.__dir = dir;
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('recordUserPrompt writes one L0 user line with sessionKey', async () => {
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projX', prompt: '真实问题', cwd: '/tmp/projX' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0, 10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    const last = JSON.parse(files[files.length - 1]);
    expect(last.sessionKey).toBe('projX');
    expect(last.role).toBe('user');
    expect(last.content).toBe('真实问题');
  });

  it('recordStopIncrement appends assistant line with afterTimestamp', async () => {
    const ts = Date.now();
    const transcript = join(dir, 'transcript.jsonl');
    // Write a transcript with one user + one assistant message (assistant at ts)
    const assistantText = '这是助手回复';
    writeFileSync(transcript,
      JSON.stringify({ type: 'user', message: { role: 'user', content: '问题' } }) + '\n' +
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: assistantText }] }, timestamp: ts }) + '\n'
    );
    await recordStopIncrement({ baseDir: dir, sessionKey: 'projX', transcriptPath: transcript, cwd: '/tmp/projX', afterTimestamp: ts - 1 });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0, 10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    const last = JSON.parse(files[files.length - 1]);
    expect(last.role).toBe('assistant');
    expect(last.content).toBe(assistantText);
  });

  it('strips harness noise from user prompt', async () => {
    const noisy = '<system_reminder>You are helpful</system_reminder>\n真实问题是什么\n<additional_data>files: [a.ts]</additional_data>';
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projY', prompt: noisy, cwd: '/tmp/projY' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0, 10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    // projY is a new session key → the last line for projY is the cleaned user line
    const last = JSON.parse(files.filter(l => l.includes('"projY"')).pop());
    expect(last.content).toBe('真实问题是什么');
    expect(last.content).not.toContain('system_reminder');
  });

  it('skips turns with no real user question (tier 0)', async () => {
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projZ', prompt: 'NO_REPLY', cwd: '/tmp/projZ' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0, 10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    // assert no new line for projZ's NO_REPLY turn (count unchanged from prior tests)
    expect(files.some(l => l.includes('NO_REPLY'))).toBe(false);
  });

  it('extracts <user_query> block content (tier 1)', () => {
    const noisy = '<user_query>你按标准设计。重新总结一下我们应该怎么改造该项目?</user_query>\n<additional_data>files: [a.ts]</additional_data>';
    expect(stripHarnessNoise(noisy)).toBe('你按标准设计。重新总结一下我们应该怎么改造该项目?');
  });

  it('skips slash commands, task notifications and skill dumps (tier 0)', () => {
    expect(stripHarnessNoise('<command-name>/effort</command-name>\n<command-args>max</command-args>')).toBeNull();
    expect(stripHarnessNoise('<task-notification>\n<task-id>abc</task-id>\n</task-notification>')).toBeNull();
    expect(stripHarnessNoise('Base directory for this skill: /Users/x/.claude/skills/foo\n<SUBAGENT-STOP>...')).toBeNull();
  });
});
