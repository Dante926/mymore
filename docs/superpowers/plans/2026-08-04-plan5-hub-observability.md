# Plan 5: hub 展示 + 配置 UI + 可观测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the hub (localhost:3456) from a read-only SQLite stats dashboard into the L0→L3 pipeline's user-facing surface: three-layer memory cards (L1/L2/L3), LLM config UI, and pipeline observability — plus unify the L1/L2/L3 failure contract (Plan 4 I3).

**Architecture:** Extends `apps/hub/server.js` with new file-reading (records JSONL for L1, scene_blocks/ + scene_index.json for L2, persona.md for L3) alongside the existing SQLite reads, adds `GET /api/config` + `PUT /api/config` (writes `~/.mymore/config.json` via `saveConfig` from `@mymore/core`), `GET /api/l1` + `GET /api/scenes` + `GET /api/persona` (three-layer data), `GET /api/pipeline` (pipeline log tail + status). Rewrites `dashboard.html` to render the three layers + a config form. mcp-server's L1Runner/L2/L3 get a unified failure contract (consistent `{ok, error}` result shape instead of mixed success:false/throw).

**Tech Stack:** Node 22 (node:sqlite + node:http + fs, zero new deps), `@mymore/core` (loadConfig/saveConfig), vanilla JS dashboard.

## Global Constraints

- Node >= 22.14. hub uses `node:http` + `node:sqlite` + `node:fs` — NO runtime deps.
- **hub currently has NO package.json.** To enable vitest for hub tests, Task 2 adds a minimal `apps/hub/package.json` (`{"name":"mymore-hub","type":"module"}` + `vitest` as devDependency). Hub runtime stays zero-dep.
- **I3 unification (Plan 4 final review)**: L1 (`extractL1Memories`) returns `{success:false, ...}` on LLM failure; L2 (`extractL2`) and L3 (`generatePersona`) throw. Unify to a consistent contract: L2/L3 wrap their throws into a returned `{ok:false, error}` shape (callers already catch at the scheduler; the contract becomes "scheduler catches, logs, degrades").
- hub reads from BOTH SQLite (existing stats) AND filesystem (records/ scene_blocks/ persona.md) — the filesystem is the source of truth for L1/L2/L3.
- **hub writes config.json** (breaks the readOnly-only stance; this is the one deliberate write). Config schema INLINED in `config-handler.js` (hub has no @mymore/core dep), matching core's `MyMoreConfig` shape.
- config.json write is atomic (tmp + rename) to avoid corrupting the file the mcp-server reads.
- Dashboard renders three layers: L1 cards (priority desc: `[type] ⭐priority` + content + scene + time/version/source), L2 scene cards (heat desc: summary + name + heat + updated), L3 persona (Archetype + chapters). Plus a config form (LLM baseUrl/apiKey/model/embeddingModel + pipeline params) and pipeline status (last run per stage / pending / errors).
- Tests use `mkdtempSync(tmpdir())` + a temp MYMORE_ROOT; never touch `~/.mymore`.
- TDD: write failing test → verify fail → implement → verify pass → commit. Commit per task.

---

### Task 1: Unify L1/L2/L3 failure contract (I3)

**Files:**
- Modify: `packages/core/src/scene/scene-extractor.ts` (extractL2 returns ok:false instead of throwing)
- Modify: `packages/core/src/persona/persona-generator.ts` (generatePersona returns ok:false instead of throwing)
- Modify: `apps/mcp-server/src/bootstrap.ts` (scheduler callers handle the unified shape)
- Test: `packages/core/test/scene-extractor.test.ts`, `packages/core/test/persona-generator.test.ts`

**Interfaces:**
- Consumes: existing `L2Result`, `PersonaResult`
- Produces:
  - `L2Result` gains `ok: boolean; error?: string` (extractL2 no longer throws on parse failure; returns `{ok:false, error}`).
  - `PersonaResult` gains `ok: boolean; error?: string` (generatePersona no longer throws on write/validation failure; returns `{ok:false, error}`).
  - Scheduler callers check `.ok` instead of try/catch.

- [ ] **Step 1: Write the failing test**

In `packages/core/test/scene-extractor.test.ts` append:
```ts
it('returns ok:false with error on parse failure (no throw, no file write)', async () => {
  const llm = fakeLlm('garbage non-json output');
  const extractor = new SceneExtractor({ llm, scenesDir: '/tmp/scenes' });
  const result = await extractor.extractL2({ newRecords: [], existingScenes: [], lastSceneIndex: [] });
  expect(result.ok).toBe(false);
  expect(typeof result.error).toBe('string');
});
```
In `packages/core/test/persona-generator.test.ts` append:
```ts
it('returns ok:false when persona write fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'persona-'));
  const llm = { run: async () => '' } as unknown as LLMRunner; // empty output
  const gen = new PersonaGenerator({ llm, personaPath: join(dir, 'persona.md'), dataDir: dir });
  const result = await gen.generatePersona({ mode: 'first', changedScenes: [] });
  expect(result.ok).toBe(false); // empty content → read-back validation fails
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/scene-extractor.test.ts test/persona-generator.test.ts`
Expected: FAIL — `result.ok` undefined (currently throws or lacks ok).

- [ ] **Step 3: Implement**

- `scene-extractor.ts`: wrap `extractL2` body; on parse failure return `{ok:false, error: message}` (no file writes). Successful actions return `{...result, ok:true}`.
- `persona-generator.ts`: `generatePersona` catches write/validation errors, returns `{ok:false, error}`. Success → `{ok:true, ...}`.
- `bootstrap.ts`: update `runL2Extraction`/`runL3Generation` to check `.ok` (keep the scheduler's degrade-on-failure behavior).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run` + `cd apps/mcp-server && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scene/scene-extractor.ts packages/core/src/persona/persona-generator.ts apps/mcp-server/src/bootstrap.ts packages/core/test/scene-extractor.test.ts packages/core/test/persona-generator.test.ts
git commit -m "refactor(core): 统一 L1/L2/L3 失败契约 — extractL2/generatePersona 返回 ok:false 而非 throw (I3)"
```

---

### Task 2: hub config API (GET/PUT /api/config)

**Files:**
- Modify: `apps/hub/server.js` (add config routes)
- Test: `apps/hub/test/config.test.js` (new, plain node test or vitest)

**Interfaces:**
- Consumes: `loadConfig`, `saveConfig` from `@mymore/core` — **NOTE: hub has NO package.json / no @mymore/core dep** (it's a zero-dep `node:sqlite` + `node:http` script). So `config-handler.js` must INLINE the config schema + atomic write (do NOT import core). Keep the config shape identical to core's `MyMoreConfig` (`{llm:{baseUrl,apiKey,model,embeddingModel?}, pipeline:{everyNConversations,l1IdleTimeoutSeconds,l2DelayAfterL1Seconds,l2MinIntervalSeconds,l2MaxIntervalSeconds,triggerEveryN}}`).
- Produces:
  - `GET /api/config` → `{ config: MyMoreConfig }` (read config.json from `MYMORE_ROOT`, merge defaults)
  - `PUT /api/config` → body is the config object; validate against the inline schema; write atomically (tmp + rename); return `{ok:true, config}` or `{error}` on invalid.

- [ ] **Step 1: Write the failing test**

`apps/hub/test/config.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getConfig, putConfig } from '../config-handler.js'; // extracted handler

describe('hub config', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hubcfg-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('getConfig returns defaults when no file', () => {
    const { config } = getConfig(dir);
    expect(config.pipeline.everyNConversations).toBe(5);
  });

  it('putConfig writes atomically and validates', () => {
    const { ok, config } = putConfig({ llm: { baseUrl: 'http://x', apiKey: 'k', model: 'm' }, pipeline: { everyNConversations: 3, l1IdleTimeoutSeconds: 600, l2DelayAfterL1Seconds: 90, l2MinIntervalSeconds: 900, l2MaxIntervalSeconds: 3600, triggerEveryN: 10 } }, dir);
    expect(ok).toBe(true);
    expect(config.llm.baseUrl).toBe('http://x');
    // file written atomically (no .tmp leftover)
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
    expect(existsSync(join(dir, 'config.json.tmp'))).toBe(false);
  });

  it('putConfig rejects invalid config', () => {
    const { ok } = putConfig({ llm: { baseUrl: 123 } }, dir);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/config.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config-handler.js**

Extract a `config-handler.js` module (testable without HTTP): `getConfig(root)` (read `config.json`, merge defaults), `putConfig(config, root)` (validate against a zod-like schema — either import core's or inline a minimal check; write atomically tmp+rename). Then wire into `server.js` routes.

Note: if hub adding `@mymore/core` as a dep is acceptable (it's the same repo workspace), import `loadConfig`/`saveConfig`; otherwise inline the schema. Prefer importing core if the workspace link exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/config.test.js`
Expected: pass.

- [ ] **Step 5: Wire into server.js**

Add `GET /api/config` + `PUT /api/config` to `route()`. PUT parses JSON body, calls `putConfig`, returns result.

- [ ] **Step 6: Commit**

```bash
git add apps/hub/config-handler.js apps/hub/server.js apps/hub/test/config.test.js
git commit -m "feat(hub): 配置 API — GET/PUT /api/config (原子写 + 校验)"
```

---

### Task 3: hub three-layer data API (L1/L2/L3)

**Files:**
- Modify: `apps/hub/server.js` (add L1/L2/L3 routes)
- Test: `apps/hub/test/layers.test.js`

**Interfaces:**
- Consumes: filesystem (records/ scene_blocks/ persona.md), SQLite (existing)
- Produces:
  - `GET /api/l1` → `{ memories: L1Record[] }` — read `records/YYYY-MM-DD.jsonl`, parse each line as L1Record, sort priority desc.
  - `GET /api/scenes` → `{ scenes: SceneIndexEntry[] }` — read `scene_index.json` (or scan scene_blocks/), sort heat desc.
  - `GET /api/persona` → `{ persona: string | null }` — read `persona.md`, null if absent.
  - `GET /api/pipeline` → `{ stages: { l0, l1, l2, l3: { lastRun, durationMs, ok, pending } }, logs: string[] }` — tail pipeline log + mcp-server status.

- [ ] **Step 1: Write the failing test**

`apps/hub/test/layers.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getL1, getScenes, getPersona } from '../layers-handler.js';

describe('hub layers', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hublay-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('getL1 reads records JSONL, sorts priority desc', () => {
    mkdirSync(join(dir, 'records'), { recursive: true });
    writeFileSync(join(dir, 'records', '2026-08-07.jsonl'),
      JSON.stringify({ id: 'a', type: 'persona', content: '低优先级', priority: 50, source_message_ids: [], created_at: '2026-08-07', version: 1 }) + '\n' +
      JSON.stringify({ id: 'b', type: 'episodic', content: '高优先级', priority: 90, source_message_ids: [], created_at: '2026-08-07', version: 1 }) + '\n');
    const { memories } = getL1(dir);
    expect(memories[0].priority).toBe(90);
    expect(memories[0].content).toBe('高优先级');
  });

  it('getScenes reads scene_index.json heat desc', () => {
    mkdirSync(join(dir, 'scene_blocks'), { recursive: true });
    writeFileSync(join(dir, 'scene_index.json'), JSON.stringify([
      { path: 'a.md', summary: 'x', heat: 2, updated: 't' },
      { path: 'b.md', summary: 'y', heat: 5, updated: 't' },
    ]));
    const { scenes } = getScenes(dir);
    expect(scenes[0].heat).toBe(5);
  });

  it('getPersona returns null when absent', () => {
    expect(getPersona(dir).persona).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/layers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement layers-handler.js**

Extract `layers-handler.js`: `getL1(root)` (scan records/*.jsonl, parse L1Record, priority desc), `getScenes(root)` (read scene_index.json, heat desc; fallback scan scene_blocks/), `getPersona(root)` (read persona.md, null if absent). Wire into server.js routes.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/layers.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hub/layers-handler.js apps/hub/server.js apps/hub/test/layers.test.js
git commit -m "feat(hub): 三层数据 API — /api/l1 /api/scenes /api/persona"
```

---

### Task 4: hub pipeline status API

**Files:**
- Modify: `apps/hub/server.js` (add /api/pipeline)
- Test: `apps/hub/test/pipeline.test.js`

**Interfaces:**
- Consumes: `~/.mymore/logs/pipeline-YYYY-MM-DD.jsonl`, mcp-server process status
- Produces:
  - `GET /api/pipeline` → `{ stages: { l0, l1, l2, l3 }, pendingL1, lastErrors, logLines }` — tail the pipeline log (last N lines, parse JSON), derive per-stage last run/ok/duration. If mcp-server not running (no health), report that.

**PREREQUISITE — mcp-server must WRITE the pipeline log:** currently `bootstrap.ts` only `console.error`s `[pipeline] L1 ready`/`L2 done`/`L3 done`. This task also adds a small `appendPipelineLog(stage, ok, durationMs)` helper in mcp-server that appends `{ts, stage, ok, durationMs}` to `~/.mymore/logs/pipeline-YYYY-MM-DD.jsonl` (mkdir recursive). Call it at the end of L1Runner.run / runL2Extraction / runL3Generation. Keep the console.error too (stderr, not stdout).

- [ ] **Step 1: Write the failing test**

`apps/hub/test/pipeline.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPipelineStatus } from '../pipeline-handler.js';

describe('hub pipeline', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'hubpipe-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('tails pipeline log and derives stage status', () => {
    mkdirSync(join(dir, 'logs'), { recursive: true });
    writeFileSync(join(dir, 'logs', 'pipeline-2026-08-07.jsonl'),
      JSON.stringify({ ts: '2026-08-07T10:00:00Z', stage: 'L1', ok: true, durationMs: 120 }) + '\n' +
      JSON.stringify({ ts: '2026-08-07T10:01:00Z', stage: 'L2', ok: true, durationMs: 300 }) + '\n');
    const { stages } = getPipelineStatus(dir);
    expect(stages.l1.lastOk).toBe(true);
    expect(stages.l2.durationMs).toBe(300);
  });

  it('handles missing log', () => {
    const { stages } = getPipelineStatus(join(dir, 'nonexistent'));
    expect(stages.l1.lastRun).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/pipeline.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pipeline-handler.js**

`getPipelineStatus(root)`: read `logs/pipeline-*.jsonl` (latest day), parse each line, group by stage, take last per stage → `{lastRun, ok, durationMs}`, plus `logLines` (last 20 raw). Wire into server.js `GET /api/pipeline`.

Note: mcp-server must WRITE the pipeline log — verify the current `[pipeline] L1 ready`/`L2 done`/`L3 done` console.error lines also append to `~/.mymore/logs/pipeline-YYYY-MM-DD.jsonl`. If not, add that (small mcp-server change).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run test/pipeline.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hub/pipeline-handler.js apps/hub/server.js apps/hub/test/pipeline.test.js
git commit -m "feat(hub): 管线状态 API — /api/pipeline (日志尾随 + 阶段状态)"
```

---

### Task 5: Dashboard — three-layer cards + config form

**Files:**
- Modify: `apps/hub/dashboard.html`
- Test: manual verification (documented)

**Interfaces:**
- Consumes: `/api/l1`, `/api/scenes`, `/api/persona`, `/api/config`, `/api/pipeline`
- Produces: dashboard renders:
  - **L1 tab**: memory cards (priority desc) — `[type] ⭐priority` badge + content + scene_name + created_at/version/source count.
  - **L2 tab**: scene cards (heat desc) — scene_name + summary + heat badge + updated.
  - **L3 tab**: persona.md rendered (Archetype + chapters), or "no persona yet".
  - **Config tab**: form for LLM baseUrl/apiKey/model/embeddingModel + pipeline params; Save → PUT /api/config; shows validation errors.
  - **Pipeline tab**: per-stage last run/ok/duration + pending + recent log lines; mcp-server up/down indicator.

- [ ] **Step 1: Write the failing test**

Manual verification (dashboard is HTML/JS, no unit test infra). Document expected behavior:
- Open `http://localhost:3456` → see 4-5 tabs (L1/L2/L3/Config/Pipeline).
- L1 tab shows structured cards (type/priority/content/scene).
- Config tab loads current config; Save with valid input → success; invalid → error shown.
- Pipeline tab shows mcp-server status + last L1/L2/L3 runs.

- [ ] **Step 2: Implement dashboard.html**

Rewrite the render logic: fetch the new APIs, render three-layer cards + config form + pipeline status. Keep the existing dark/light theme. Use vanilla JS (no build step).

- [ ] **Step 3: Verify manually**

Run `cd apps/hub && node server.js`, open `http://localhost:3456`, verify tabs render (document screenshots or notes in report).

- [ ] **Step 4: Commit**

```bash
git add apps/hub/dashboard.html
git commit -m "feat(hub): 三层记忆卡片 + 配置表单 + 管线状态 Dashboard"
```

---

### Task 6: Full-suite verification + doc

**Files:**
- Verify: all packages build + tests pass
- Docs: verification note in the plan doc

**Interfaces:**
- Produces: green full suite, hub serving three-layer data + config + pipeline.

- [ ] **Step 1: Build all**

Run: `cd /Users/admin/Desktop/dante926/mymore && pnpm build`
Expected: core (father) + mcp-server (tsup) + hub (no build, plain JS) succeed.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run` → all pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run` → all pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/apps/hub && npx vitest run` → all pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run` → all pass.

- [ ] **Step 3: Smoke test hub end-to-end**

Run hub with a temp MYMORE_ROOT, populate sample records/scenes/persona, verify `/api/l1` `/api/scenes` `/api/persona` `/api/config` `/api/pipeline` return data. Document.

- [ ] **Step 4: Commit (if any doc changes)**

```bash
git add -A
git commit -m "chore: Plan 5 全量验证 + 构建确认"
```
(If no changes, note it and skip commit.)
