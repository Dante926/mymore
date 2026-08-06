# Plan 2: L0 捕获 + 调度骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the L0 capture layer (hooks as sensors writing L0 JSONL) and the pipeline scheduler skeleton (mcp-server as the brain with HTTP notify port + PipelineManager) that will drive L1/L2/L3 in Plan 3+.

**Architecture:** Two processes on the same machine. Hooks (short-lived) write incremental conversation messages to L0 JSONL files (source of truth, via `@mymore/core`'s `recordConversation`), then fire-and-forget an HTTP notify to the mcp-server's localhost port. mcp-server (long-lived, now on the host not Docker) listens on that port, and a `PipelineManager` schedules L1/L2/L3 runs by threshold / warm-up / idle-timeout / shutdown-flush. This replaces the old "hooks directly touch SQLite" model — hooks now touch ONLY L0 files, never SQLite (spec §3.1).

**Tech Stack:** Node 22 (host, fetch built-in), `node:http` (notify port, zero deps), `@mymore/core` (L0 recorder from Plan 1), vitest.

## Global Constraints

- Node >= 22.14 (dev: 22.21.1). `fetch` and `node:http` are built-in — NO new deps for the notify channel.
- **Hooks NEVER touch SQLite.** They write L0 JSONL only (via `recordConversation`) and POST a notify. All DB/index writes go through mcp-server.
- **mcp-server runs on the HOST**, not Docker. `.claude-plugin/.mcp.json` drops `docker exec`; the command becomes a plain `node` invocation.
- Notify port: `localhost:3477`, bound to 127.0.0.1 only (never 0.0.0.0). Endpoint `POST /notify` returns 200 fast, no auth (localhost only), body `{}` acceptable.
- Hook protocol unchanged: read JSON from stdin, write JSON to stdout, never block the user.
- **Hooks stop swallowing exceptions.** Replace `process.on('uncaughtException', () => process.exit(0))` with structured logging to `~/.mymore/logs/hooks-YYYY-MM-DD.jsonl` + still return `{continue:true}` (don't block user, but log the error).
- L0 writes: `recordConversation` (from Plan 1) — incremental via `afterTimestamp`, `originalUserText` for the real user question. Use `mkdtempSync(tmpdir())` in tests; never touch `~/.mymore`.
- TDD: write failing test → verify fail → implement → verify pass → commit. Commit per task.

---

### Task 1: Move mcp-server to host (drop docker exec)

**Files:**
- Modify: `.claude-plugin/.mcp.json` (command from docker exec → host node)
- Test: manual verification (documented in task report)

**Interfaces:**
- Consumes: existing `apps/mcp-server/dist/bootstrap.js` (built by tsup)
- Produces: mcp-server launchable on host as `node apps/mcp-server/dist/bootstrap.js`

- [ ] **Step 1: Verify the host build works**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && pnpm build` (tsup → dist/bootstrap.js), then confirm dist exists.
Run: `node -e "import('./dist/bootstrap.js').catch(e => console.log('EXIT', e.message))"` with a 1s timeout — it should start the MCP server and wait on stdio (expect it to hang on stdin, then Ctrl-C). Document that the server starts cleanly on host.

- [ ] **Step 2: Write the failing test (verification is manual — no code change yet)**

This is a config change, verified by inspection. Expected BEFORE: `.mcp.json` uses `docker exec -i mymore-mcp`.

- [ ] **Step 3: Edit .claude-plugin/.mcp.json**

Change to:
```json
{
  "mcpServers": {
    "mymore": {
      "command": "node",
      "args": ["/Users/admin/Desktop/dante926/mymore/apps/mcp-server/dist/bootstrap.js"],
      "env": {
        "MYMORE_ROOT": "/Users/admin/.mymore"
      }
    }
  }
}
```
(Use the absolute host path to the built bootstrap. `MYMORE_ROOT` points to the host `~/.mymore`.)

- [ ] **Step 4: Verify the new config is well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/.mcp.json','utf8')); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/.mcp.json
git commit -m "refactor(mcp): mcp-server 移至宿主主机运行（去掉 docker exec）"
```

---

### Task 2: Hook sensors — write L0 incremental + notify

**Files:**
- Modify: `hooks/scripts/inject-memories.js` (UserPromptSubmit)
- Modify: `hooks/scripts/store-memories.js` (Stop)
- Create: `hooks/scripts/utils/l0-sensor.js` (shared helper: write L0 + notify)
- Test: `hooks/test/l0-sensor.test.js` (new, vitest or plain node assert)

**Interfaces:**
- Consumes: `recordConversation`, `readConversationMessages` from `@mymore/core`
- Produces:
  - `notifyServer(sessionKey: string): Promise<void>` — POST `http://127.0.0.1:3477/notify` with `{sessionKey}` body, fire-and-forget, swallow network errors (log, don't crash). Returns without awaiting.
  - `recordUserPrompt(sessionKey, prompt, cwd): Promise<void>` — calls `recordConversation` with the user's real question (after harness-noise stripping), then `notifyServer`.
  - `recordStopIncrement(sessionKey, transcriptPath, cwd): Promise<void>` — reads transcript, extracts assistant text, appends to L0 with `afterTimestamp` cursor, then `notifyServer`.

- [ ] **Step 1: Write the failing test**

`hooks/test/l0-sensor.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { recordUserPrompt, recordStopIncrement } from '../scripts/utils/l0-sensor.js';

describe('l0-sensor', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l0sensor-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('recordUserPrompt writes one L0 user line with sessionKey', async () => {
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projX', prompt: '真实问题', cwd: '/tmp/projX' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0,10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
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
    require('fs').writeFileSync(transcript,
      JSON.stringify({ type: 'user', message: { role: 'user', content: '问题' } }) + '\n' +
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: assistantText }] }, timestamp: ts }) + '\n'
    );
    await recordStopIncrement({ baseDir: dir, sessionKey: 'projX', transcriptPath: transcript, cwd: '/tmp/projX', afterTimestamp: ts - 1 });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0,10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    const last = JSON.parse(files[files.length - 1]);
    expect(last.role).toBe('assistant');
    expect(last.content).toBe(assistantText);
  });

  it('strips harness noise from user prompt', async () => {
    const noisy = '<system_reminder>You are helpful</system_reminder>\n真实问题是什么\n<additional_data>files: [a.ts]</additional_data>';
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projY', prompt: noisy, cwd: '/tmp/projY' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0,10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    const last = JSON.parse(files[files.length - 1]);
    expect(last.content).toBe('真实问题是什么');
    expect(last.content).not.toContain('system_reminder');
  });

  it('skips turns with no real user question (tier 0)', async () => {
    await recordUserPrompt({ baseDir: dir, sessionKey: 'projZ', prompt: 'NO_REPLY', cwd: '/tmp/projZ' });
    const files = readFileSync(join(dir, 'conversations', `${new Date().toISOString().slice(0,10)}.jsonl`), 'utf-8').split('\n').filter(Boolean);
    // assert no new line for projZ's NO_REPLY turn (count unchanged from prior tests)
    expect(files.some(l => l.includes('NO_REPLY'))).toBe(false);
  });
});
```
(Flesh out the transcript fixture to contain a user + assistant message with timestamps, and assert the assistant text lands in L0.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run test/l0-sensor.test.js`
Expected: FAIL — module `../scripts/utils/l0-sensor.js` not found.

- [ ] **Step 3: Implement l0-sensor.js**

- `notifyServer(sessionKey)`: `fetch('http://127.0.0.1:3477/notify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({sessionKey}) }).catch(() => {})` — fire-and-forget, never throw.
- `stripHarnessNoise(prompt)`: extract the real user question — 3-tier (spec §3.2 L0 清洗):
  - Tier 0: if the prompt matches an internal/system pattern (e.g. session-resume recap, `NO_REPLY`, slash command), return `null` (don't record this turn).
  - Tier 1: extract the `<user_query>` block content if present.
  - Tier 2: strip known harness tags (`<system_reminder>`, `<additional_data>`, `<user_info>`, timestamps, tool echo) leaving the core text.
  - If the result is empty/whitespace after stripping, return `null`.
- `recordUserPrompt`: strip harness noise first; if null, skip entirely (no L0 write, no notify). Else `recordConversation({ sessionKey, messages: [{role:'user', content: cleaned}], baseDir, originalUserText: cleaned })`, then notify.
- `recordStopIncrement`: read transcript lines, find last assistant text (string content, skip tool/thinking), call `recordConversation` with `afterTimestamp`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run test/l0-sensor.test.js`
Expected: all pass.

- [ ] **Step 5: Wire into inject-memories.js and store-memories.js**

Replace the current "search + inject" (inject-memories) and "consolidate only" (store-memories) bodies to call `recordUserPrompt` / `recordStopIncrement`. Keep the hook output contract (`{continue:true}`). Remove the `process.on('uncaughtException', exit)` swallow — replace with try/catch that logs to `hooks-*.jsonl` and still returns `{continue:true}`.

- [ ] **Step 6: Commit**

```bash
git add hooks/scripts/utils/l0-sensor.js hooks/scripts/inject-memories.js hooks/scripts/store-memories.js hooks/test/l0-sensor.test.js
git commit -m "feat(hooks): hook 传感器化 — 写 L0 增量 + HTTP 通知，废除吞异常"
```

---

### Task 3: Hook structured logging

**Files:**
- Modify: `hooks/scripts/utils/debug.js` (add structured logging to `~/.mymore/logs/hooks-YYYY-MM-DD.jsonl`)
- Test: `hooks/test/debug.test.js`

**Interfaces:**
- Consumes: existing `debug()` / `setDebugPrefix()`
- Produces: `debug(prefix, msg, data?)` now ALSO appends a JSON line to `~/.mymore/logs/hooks-YYYY-MM-DD.jsonl` (always, not just when `MYMORE_DEBUG=1`). Every hook event (start/end/error) is logged there regardless of debug flag.

- [ ] **Step 1: Write the failing test**

`hooks/test/debug.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setLogDir, debug } from '../scripts/utils/debug.js';

describe('hook logging', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hlog-')); setLogDir(dir); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('always writes a JSON line (not gated by MYMORE_DEBUG)', () => {
    setDebugPrefix('test');
    debug('event', { key: 'value' });
    const logPath = join(dir, 'logs', `hooks-${new Date().toISOString().slice(0,10)}.jsonl`);
    expect(existsSync(logPath)).toBe(true);
    const line = JSON.parse(readFileSync(logPath, 'utf-8').trim().split('\n').pop());
    expect(line.prefix).toBe('test');
    expect(line.message).toBe('event');
    expect(line.data).toEqual({ key: 'value' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run test/debug.test.js`
Expected: FAIL — `setLogDir` not exported / no log file written.

- [ ] **Step 3: Implement**

In `debug.js`: add `setLogDir(root)`, `setDebugPrefix`. Make `debug()` always append a JSON line `{timestamp, prefix, message, data}` to `${logDir}/logs/hooks-YYYY-MM-DD.jsonl` (mkdir recursive), independent of `MYMORE_DEBUG`. Keep the console/debug-flag behavior for the `MYMORE_DEBUG=1` case (double-logging is fine).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run test/debug.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/scripts/utils/debug.js hooks/test/debug.test.js
git commit -m "feat(hooks): 结构化日志 — 每次 hook 事件写 hooks-YYYY-MM-DD.jsonl"
```

---

### Task 4: mcp-server HTTP notify port

**Files:**
- Create: `apps/mcp-server/src/notify-server.ts`
- Modify: `apps/mcp-server/src/bootstrap.ts` (start notify server)
- Test: `apps/mcp-server/test/notify-server.test.ts`

**Interfaces:**
- Consumes: nothing (standalone)
- Produces:
  - `startNotifyServer(port: number, handler: (sessionKey: string) => void): Promise<{ close(): Promise<void> }>` — starts `node:http` server on `127.0.0.1:port`. `POST /notify` parses `{sessionKey}`, calls handler, returns 200 `{ok:true}`. Any other method → 405. Binds 127.0.0.1 only.
  - The handler in bootstrap increments a pending-counter or directly pokes the PipelineManager (Task 5).

- [ ] **Step 1: Write the failing test**

`apps/mcp-server/test/notify-server.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startNotifyServer } from '../src/notify-server.js';

describe('notify-server', () => {
  let server; let received: string[] = [];
  beforeAll(async () => {
    server = await startNotifyServer(0, (sessionKey) => received.push(sessionKey)); // port 0 = random
  });
  afterAll(async () => { await server.close(); });

  it('POST /notify calls handler and returns ok', async () => {
    const port = (server as any).port();
    const res = await fetch(`http://127.0.0.1:${port}/notify`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({sessionKey:'projA'}),
    });
    expect(res.status).toBe(200);
    await new Promise(r => setTimeout(r, 50));
    expect(received).toContain('projA');
  });

  it('rejects non-POST', async () => {
    const port = (server as any).port();
    const res = await fetch(`http://127.0.0.1:${port}/notify`);
    expect(res.status).toBe(405);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run test/notify-server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement notify-server.ts**

```ts
import http from 'node:http';

export async function startNotifyServer(port: number, handler: (sessionKey: string) => void) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/notify') {
      res.writeHead(405, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'method not allowed'}));
      return;
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { sessionKey } = JSON.parse(body || '{}');
        handler(sessionKey || '');
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true}));
      } catch { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'bad body'})); }
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const actualPort = (server.address() as any).port;
  return {
    port: () => actualPort,
    close: () => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run test/notify-server.test.ts`
Expected: pass.

- [ ] **Step 5: Wire into bootstrap.ts**

In `bootstrap.ts`, start the notify server on `3477` (configurable via `MYMORE_NOTIFY_PORT`, default 3477). The handler will be connected to the PipelineManager in Task 5 — for now, log the notify.

- [ ] **Step 6: Commit**

```bash
git add apps/mcp-server/src/notify-server.ts apps/mcp-server/src/bootstrap.ts apps/mcp-server/test/notify-server.test.ts
git commit -m "feat(mcp): HTTP 通知端口 (127.0.0.1:3477 /notify) 接收 hook 通知"
```

---

### Task 5: PipelineManager scheduler skeleton

**Files:**
- Create: `apps/mcp-server/src/pipeline-manager.ts`
- Modify: `apps/mcp-server/src/bootstrap.ts` (wire notify → PipelineManager)
- Test: `apps/mcp-server/test/pipeline-manager.test.ts`

**Interfaces:**
- Consumes: `readConversationMessages` from `@mymore/core` (L0 incremental read), config from `@mymore/core` `loadConfig`
- Produces:
  - `class PipelineManager { constructor(opts: { baseDir: string; sessionKey: string; cfg: { everyNConversations: number; l1IdleTimeoutSeconds: number }; onL1Ready: (messages) => void }); notifyTurn(): void; flush(): Promise<void>; getPendingCount(): number }`
  - `notifyTurn()` increments `conversationCount`; when `>= effectiveThreshold` (warm-up 1→2→4→8→everyN), calls `onL1Ready` and resets count, advancing the warm-up threshold.
  - `flush()`: called on shutdown/SessionEnd — if pending count > 0, triggers `onL1Ready` with accumulated messages.
  - Pending messages accumulate via `readConversationMessages(sessionKey, baseDir, afterTimestamp)`.

- [ ] **Step 1: Write the failing test**

`apps/mcp-server/test/pipeline-manager.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PipelineManager } from '../src/pipeline-manager.js';

describe('PipelineManager', () => {
  let dir; let calls: number[] = [];
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'pm-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const make = (everyN = 5) => new PipelineManager({
    baseDir: dir, sessionKey: 'projA',
    cfg: { everyNConversations: everyN, l1IdleTimeoutSeconds: 600 },
    onL1Ready: () => { calls.push(1); },
  });

  it('warm-up: fires at 1, 2, 4 then everyN (clamped)', () => {
    const pm = make(5); calls = [];
    pm.notifyTurn(); expect(calls.length).toBe(1); // warmup 1 → threshold 1, fire
    pm.notifyTurn(); expect(calls.length).toBe(2); // warmup 2 → threshold 2, fire
    pm.notifyTurn(); expect(calls.length).toBe(2); // warmup 4, below 4
    pm.notifyTurn(); expect(calls.length).toBe(3); // threshold 4, fire
    pm.notifyTurn(); expect(calls.length).toBe(3); // warmup 8→clamp 5, below 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // below 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // below 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // below 5
    pm.notifyTurn(); expect(calls.length).toBe(4); // 5th turn → threshold 5, fire
  });

  it('flush triggers onL1Ready with pending', () => {
    const pm = make(5); calls = [];
    pm.notifyTurn(); pm.notifyTurn(); // 2 pending (below threshold 8 now)
    const before = calls.length;
    pm.flush();
    expect(calls.length).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run test/pipeline-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pipeline-manager.ts**

```ts
import { readConversationMessages } from '@mymore/core';

export interface PipelineManagerOptions {
  baseDir: string;
  sessionKey: string;
  cfg: { everyNConversations: number; l1IdleTimeoutSeconds: number };
  onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>) => void;
}

export class PipelineManager {
  private conversationCount = 0;
  private warmupThreshold = 1;
  private cfg: { everyNConversations: number; l1IdleTimeoutSeconds: number };
  private onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>) => void;
  private lastL1At = 0;
  private lastL1Timestamp = 0;
  private baseDir: string;
  private sessionKey: string;

  constructor(opts: PipelineManagerOptions) {
    this.baseDir = opts.baseDir;
    this.sessionKey = opts.sessionKey;
    this.cfg = opts.cfg;
    this.onL1Ready = opts.onL1Ready;
  }

  getEffectiveThreshold(): number {
    return Math.min(this.warmupThreshold, this.cfg.everyNConversations);
  }

  getPendingCount(): number {
    return this.conversationCount;
  }

  notifyTurn(): void {
    this.conversationCount++;
    if (this.conversationCount >= this.getEffectiveThreshold()) {
      this.triggerL1();
    }
  }

  private triggerL1(): void {
    this.onL1Ready([]); // messages wired in Plan 3 (L1 extraction reads L0 itself)
    this.conversationCount = 0;
    this.warmupThreshold *= 2; // advance warm-up: 1→2→4→8→clamped by everyN
    this.lastL1At = Date.now();
  }

  async flush(): Promise<void> {
    if (this.conversationCount > 0) this.triggerL1();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run test/pipeline-manager.test.ts`
Expected: pass.

- [ ] **Step 5: Wire into bootstrap.ts**

Connect notify handler → `pipelineManager.notifyTurn()`. On `SessionEnd`/SIGTERM → `pipelineManager.flush()`. `onL1Ready` for now just logs (L1 extraction is Plan 3); the skeleton demonstrates the scheduling.

- [ ] **Step 6: Commit**

```bash
git add apps/mcp-server/src/pipeline-manager.ts apps/mcp-server/src/bootstrap.ts apps/mcp-server/test/pipeline-manager.test.ts
git commit -m "feat(mcp): PipelineManager 调度骨架 (阈值/warm-up/flush)"
```

---

### Task 6: Full-suite verification + doc

**Files:**
- Verify: all packages build + tests pass
- Docs: note in the plan doc

**Interfaces:**
- Produces: green full suite (core 63/63, mcp-server new tests, hooks new tests), host mcp-server runnable.

- [ ] **Step 1: Build all**

Run: `cd /Users/admin/Desktop/dante926/mymore && pnpm build` (core via father, mcp-server via tsup). Expected: both succeed.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run` → 63+ pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run` → new tests pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run` → new tests pass.

- [ ] **Step 3: Verify host mcp-server starts**

Run: `cd /Users/admin/Desktop/dante926/mymore && timeout 3 node apps/mcp-server/dist/bootstrap.js; echo "exit=$?"`
Expected: server starts, listens on 3477, exits via timeout (SIGTERM handled → flush).

- [ ] **Step 4: Commit (if any doc/dep changes)**

```bash
git add -A
git commit -m "chore: Plan 2 全量验证 + 构建确认"
```
(If no changes, note it and skip commit.)
