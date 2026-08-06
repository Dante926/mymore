import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const SCRIPT = join(fileURLToPath(new URL('..', import.meta.url)), 'scripts', 'session-summary.js');

const dirs = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'sesum-'));
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** Spawn the hook as a real child process (it's an executable entry, not importable). */
function runHook(input, { home, root } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: { ...process.env, HOME: home, MYMORE_ROOT: root },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    // raw string input is written verbatim (to exercise invalid-JSON handling)
    child.stdin.write(typeof input === 'string' ? input : JSON.stringify(input));
    child.stdin.end();
  });
}

describe('session-summary SessionEnd hook (I2)', () => {
  it('有 transcript → 提取 summary 写 sessions.jsonl，stdout {continue:true}，exit 0', async () => {
    const dir = tmp();
    const transcript = join(dir, 'transcript.jsonl');
    writeFileSync(
      transcript,
      [
        JSON.stringify({ type: 'user', message: { role: 'user', content: '修复 plan 2 的 4 个 finding' } }),
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '好' }] } }),
      ].join('\n') + '\n',
    );

    const { code, stdout } = await runHook(
      { cwd: '/tmp/projA', session_id: 'sess-1', transcript_path: transcript },
      { home: dir, root: dir },
    );

    expect(code).toBe(0);
    expect(stdout.trim()).toBe(JSON.stringify({ continue: true }));
    expect(existsSync(join(dir, 'sessions.jsonl'))).toBe(true);
    const entry = JSON.parse(readFileSync(join(dir, 'sessions.jsonl'), 'utf-8').trim());
    expect(entry.sessionId).toBe('sess-1');
    expect(entry.summary).toContain('修复 plan 2');
    expect(entry.groupId).toBe('projA');
  });

  it('transcript 缺失 → 不崩、stdout {continue:true}、exit 0', async () => {
    const dir = tmp();
    const { code, stdout } = await runHook(
      { cwd: '/tmp/projB', session_id: 'sess-2', transcript_path: join(dir, 'missing.jsonl') },
      { home: dir, root: dir },
    );
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(JSON.stringify({ continue: true }));
  });

  it('输入非 JSON → 不吞、结构化记录错误、stdout {continue:true}、exit 0', async () => {
    const dir = tmp();
    const { code, stdout } = await runHook('not json at all', { home: dir, root: dir });
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(JSON.stringify({ continue: true }));
    // 结构化错误日志：logError 走 /tmp/mymore-hooks.jsonl（不吞异常）
    const logLines = existsSync('/tmp/mymore-hooks.jsonl')
      ? readFileSync('/tmp/mymore-hooks.jsonl', 'utf-8').trim().split('\n').filter(Boolean)
      : [];
    expect(logLines.some((l) => l.includes('"SessionEnd"'))).toBe(true);
  });

  it('malformed transcript 行 → 容忍并计数记录，summary 仍正常写出', async () => {
    const dir = tmp();
    const transcript = join(dir, 'badlines.jsonl');
    writeFileSync(
      transcript,
      [
        'not-json-line',
        JSON.stringify({ type: 'user', message: { role: 'user', content: '正文问题' } }),
      ].join('\n') + '\n',
    );

    const { code, stdout } = await runHook(
      { cwd: '/tmp/projC', session_id: 'sess-3', transcript_path: transcript },
      { home: dir, root: dir },
    );
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(JSON.stringify({ continue: true }));
    const entry = JSON.parse(readFileSync(join(dir, 'sessions.jsonl'), 'utf-8').trim());
    expect(entry.summary).toBe('正文问题');
  });
});
