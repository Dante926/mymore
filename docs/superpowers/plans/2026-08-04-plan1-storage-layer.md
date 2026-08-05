# Plan 1: Storage Layer — L0/L1 JSONL + SQLite Index (FTS5 + sqlite-vec) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storage foundation for the L0→L3 pipeline: L0/L1 JSONL source-of-truth writers, SQLite index with structured columns + FTS5 + sqlite-vec, and an embedding client for the hosted endpoint.

**Architecture:** Extends `@mymore/core` with two new storage layers. L0/L1 are append-only JSONL files (source of truth). A SQLite DB (`.index/memory.db`) holds `memory_meta` (now with structured columns `type/priority/scene_name/version/source_message_ids/team/agent`), an FTS5 virtual table for keyword search, and a `sqlite-vec` vector table for semantic recall. An `EmbeddingClient` wraps the hosted OpenAI-compatible `/v1/embeddings` endpoint.

**Tech Stack:** TypeScript, `better-sqlite3` (unified to single version), `sqlite-vec`, `gray-matter`, `uuid`, `vitest`.

## Global Constraints

- Node >= 22.14 (dev machine: 22.21.1)
- `better-sqlite3` **unified to a single version** across all packages (currently core=13.0.1, mcp-server=^11.8.0 — resolve to one)
- JSONL is the **source of truth**; SQLite is an **index/replica**. Reads must survive index loss (reindex from JSONL).
- SQLite runs in WAL mode.
- All structured columns on `memory_meta` are nullable except `id`, `content`, `track`, `owner_id`, `created_at` (backward compat with existing rows).
- Embedding client: hosted OpenAI-compatible endpoint, base URL + key from `~/.mymore/config.json` (schema defined in Task 4).
- TDD: write failing test → run (verify fail) → implement → run (verify pass) → commit. Commit per task.

---

### Task 1: Unify better-sqlite3 version

**Files:**
- Modify: `packages/core/package.json` (`"better-sqlite3": "13.0.1"` stays as canonical)
- Modify: `apps/mcp-server/package.json` (`"better-sqlite3": "^11.8.0"` → `"13.0.1"`)

**Interfaces:**
- Consumes: nothing
- Produces: single `better-sqlite3@13.0.1` across workspace

- [ ] **Step 1: Write the failing test**

No functional test — this is a dependency-consistency task. Verification is a grep:
```bash
cd /Users/admin/Desktop/dante926/mymore
grep -rn '"better-sqlite3"' packages/*/package.json apps/*/package.json
```
Expected BEFORE fix: core=`13.0.1`, mcp-server=`^11.8.0` (two versions).

- [ ] **Step 2: Run to confirm inconsistency**

Run: `grep -rn '"better-sqlite3"' packages/core/package.json apps/mcp-server/package.json`
Expected: two different versions listed.

- [ ] **Step 3: Edit mcp-server to match**

Edit `apps/mcp-server/package.json`: change `"better-sqlite3": "^11.8.0"` to `"better-sqlite3": "13.0.1"`.

- [ ] **Step 4: Reinstall to refresh lockfile**

Run: `cd /Users/admin/Desktop/dante926/mymore && pnpm install`
Expected: install succeeds, lockfile updated to 13.0.1.

- [ ] **Step 5: Verify consistency**

Run: `grep -rn '"better-sqlite3"' packages/core/package.json apps/mcp-server/package.json`
Expected: both `"better-sqlite3": "13.0.1"`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json apps/mcp-server/package.json pnpm-lock.yaml
git commit -m "chore(deps): 统一 better-sqlite3 到 13.0.1"
```

---

### Task 2: Extend memory_meta schema with structured columns

**Files:**
- Modify: `packages/core/src/models.ts` (SCHEMA_SQL + MIGRATION_SQL + `MemoryRow` + `MemoryEntry`)
- Modify: `packages/core/src/storage.ts` (rowToMemoryRow + add + updateRow skip set)
- Test: `packages/core/test/models.test.ts`, `packages/core/test/storage.test.ts`

**Interfaces:**
- Consumes: existing `MemoryEntry`/`MemoryRow` types
- Produces: `MemoryRow` gains fields `type: string | null`, `priority: number | null`, `scene_name: string | null`, `version: number | null`, `source_message_ids: string | null` (JSON string), `team: string | null`, `agent: string | null`. `MemoryEntry` gains same fields optional. `MemoryStorage.add(entry)` and `rowToMemoryRow` preserve these.

- [ ] **Step 1: Write the failing test**

In `packages/core/test/storage.test.ts`, append:
```ts
it('should persist structured columns', () => {
  const entry: MemoryEntry = {
    id: 'test-struct-1', track: 'user', owner_id: 'alice',
    category: 'persistent', content: '用户确认方案A',
    created_at: new Date().toISOString(), frozen: false, access_count: 0,
    type: 'episodic', priority: 82, scene_name: '做 mymore 改造设计',
    version: 2, source_message_ids: '["msg_1","msg_2"]', team: 'dante', agent: 'arch',
  };
  const row = storage.add(entry);
  expect(row.type).toBe('episodic');
  expect(row.priority).toBe(82);
  expect(row.scene_name).toContain('mymore');
  expect(row.version).toBe(2);
  expect(row.team).toBe('dante');
  expect(row.agent).toBe('arch');
  const got = storage.getById('test-struct-1');
  expect(got!.source_message_ids).toBe('["msg_1","msg_2"]');
});
```
Also a migration test: reopen a DB created without the new columns and assert `runMigration()` adds them without error.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/storage.test.ts -t "structured columns"`
Expected: FAIL — `row.type` is undefined (column doesn't exist).

- [ ] **Step 3: Extend SCHEMA_SQL and MIGRATION_SQL**

In `packages/core/src/models.ts`:
- In `SCHEMA_SQL`, add to `memory_meta` table def:
  ```sql
  type TEXT, priority INTEGER, scene_name TEXT, version INTEGER,
  source_message_ids TEXT, team TEXT, agent TEXT
  ```
- Extend `MIGRATION_SQL` (runs against existing DBs):
  ```sql
  ALTER TABLE memory_meta ADD COLUMN type TEXT;
  ALTER TABLE memory_meta ADD COLUMN priority INTEGER;
  ALTER TABLE memory_meta ADD COLUMN scene_name TEXT;
  ALTER TABLE memory_meta ADD COLUMN version INTEGER;
  ALTER TABLE memory_meta ADD COLUMN source_message_ids TEXT;
  ALTER TABLE memory_meta ADD COLUMN team TEXT;
  ALTER TABLE memory_meta ADD COLUMN agent TEXT;
  ```
  (Note: `runMigration` currently uses `try/catch` per exec — keep that so already-added columns don't error.)

- [ ] **Step 4: Update MemoryRow/MemoryEntry types**

In `models.ts`, add to both interfaces (optional on Entry, nullable on Row):
```ts
type?: string;
priority?: number;
scene_name?: string;
version?: number;
source_message_ids?: string;
team?: string;
agent?: string;
```

- [ ] **Step 5: Update storage.ts add() + rowToMemoryRow()**

In `storage.ts`:
- `add()` INSERT includes the new columns (with `?? null` fallbacks).
- `rowToMemoryRow()` reads the new fields (null-coalesced).
- `updateRow()` skip set already excludes id/fts_rowid/content_sha256/created_at — new columns are updatable (good).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/storage.test.ts test/models.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/models.ts packages/core/src/storage.ts packages/core/test/storage.test.ts packages/core/test/models.test.ts
git commit -m "feat(core): memory_meta 增加结构化列 (type/priority/scene/version/source/team/agent)"
```

---

### Task 3: L0 JSONL conversation recorder

**Files:**
- Create: `packages/core/src/conversation/l0-recorder.ts`
- Test: `packages/core/test/l0-recorder.test.ts`

**Interfaces:**
- Consumes: nothing (standalone)
- Produces:
  - `interface L0MessageRecord { sessionKey: string; sessionId: string; userId?: string; agentId?: string; recordedAt: string; id: string; role: 'user'|'assistant'; content: string; timestamp: number }`
  - `recordConversation(params: { sessionKey: string; sessionId?: string; userId?: string; agentId?: string; messages: Array<{role: string; content: string|Array<unknown>; timestamp?: number}>; baseDir: string; originalUserText?: string; afterTimestamp?: number }): Promise<L0MessageRecord[]>`
  - `readConversationMessages(sessionKey: string, baseDir: string, afterTimestamp?: number, limit?: number): Promise<Array<{role:string; content:string; timestamp:number}>>`

- [ ] **Step 1: Write the failing test**

`packages/core/test/l0-recorder.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { recordConversation, readConversationMessages } from '../src/conversation/l0-recorder.js';

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
```
Add `dateStr()` helper: `new Date().toISOString().slice(0,10)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l0-recorder.test.ts`
Expected: FAIL — module `../src/conversation/l0-recorder.js` not found.

- [ ] **Step 3: Implement l0-recorder.ts**

Key logic:
- `extractUserAssistantMessages`: for each message, if `role` is user/assistant, extract `content` (string or array of `{type:'text', text}`), strip base64 data URIs → `[image]`, assign `id = msg_${Date.now()}_${randomBytes(3).hex}`, default timestamp to `Date.now()`.
- Filter by `afterTimestamp` (`m.timestamp > afterTimestamp`, strict greater).
- If `originalUserText` provided: replace the first user message's content (match by timestamp against the polluted one).
- Sanitize: trim; drop empty.
- Write to `${baseDir}/conversations/${YYYY-MM-DD}.jsonl` (mkdir recursive, appendFile).
- `readConversationMessages`: read all daily `.jsonl` files sorted, filter by sessionKey line-level, filter `timestamp > afterTimestamp`, truncate to newest `limit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l0-recorder.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/conversation/l0-recorder.ts packages/core/test/l0-recorder.test.ts
git commit -m "feat(core): L0 JSONL 会话录制器 (增量/清洗/原文替换)"
```

---

### Task 4: config.json schema + loader

**Files:**
- Create: `packages/core/src/config.ts`
- Test: `packages/core/test/config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface MyMoreConfig { llm: { baseUrl: string; apiKey: string; model: string; embeddingModel?: string }; pipeline: { everyNConversations: number; l1IdleTimeoutSeconds: number; l2DelayAfterL1Seconds: number; l2MinIntervalSeconds: number; l2MaxIntervalSeconds: number; triggerEveryN: number } }`
  - `loadConfig(rootDir?: string): MyMoreConfig` — reads `~/.mymore/config.json` (or passed root), returns defaults merged with file, throws on invalid (schema validated with zod).
  - `saveConfig(config: MyMoreConfig, rootDir?: string): void` — writes config.json (for hub UI).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig } from '../src/config.js';

describe('config', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'cfg-test-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns defaults when no config file', () => {
    const cfg = loadConfig(dir);
    expect(cfg.pipeline.everyNConversations).toBe(5);
    expect(cfg.llm.baseUrl).toBe('');
  });

  it('loads saved config', () => {
    saveConfig({ llm: { baseUrl: 'http://localhost:11434/v1', apiKey: 'k', model: 'qwen' }, pipeline: { everyNConversations: 3, l1IdleTimeoutSeconds: 600, l2DelayAfterL1Seconds: 90, l2MinIntervalSeconds: 900, l2MaxIntervalSeconds: 3600, triggerEveryN: 10 } }, dir);
    const cfg = loadConfig(dir);
    expect(cfg.llm.baseUrl).toBe('http://localhost:11434/v1');
    expect(cfg.pipeline.everyNConversations).toBe(3);
  });

  it('throws on invalid schema', () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ llm: { baseUrl: 123 } }));
    expect(() => loadConfig(dir)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/config.test.ts`
Expected: FAIL — module `../src/config.js` not found.

- [ ] **Step 3: Implement config.ts**

Use `zod` (already a dep in mcp-server; add to core if needed) with a schema:
```ts
const pipelineSchema = z.object({
  everyNConversations: z.number().default(5),
  l1IdleTimeoutSeconds: z.number().default(600),
  l2DelayAfterL1Seconds: z.number().default(90),
  l2MinIntervalSeconds: z.number().default(900),
  l2MaxIntervalSeconds: z.number().default(3600),
  triggerEveryN: z.number().default(10),
});
const llmSchema = z.object({
  baseUrl: z.string().default(''),
  apiKey: z.string().default(''),
  model: z.string().default(''),
  embeddingModel: z.string().optional(),
});
```
`loadConfig`: read `${root}/config.json` if exists, `safeParse`, if fail → throw with message; else merge defaults.
`saveConfig`: `mkdirSync(root, {recursive:true})`, write JSON.stringify(cfg, null, 2).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/config.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config.ts packages/core/test/config.test.ts
git commit -m "feat(core): config.json schema + 加载/保存 (LLM + pipeline 参数)"
```

---

### Task 5: sqlite-vec vector store + EmbeddingClient

**Files:**
- Create: `packages/core/src/vector.ts`
- Test: `packages/core/test/vector.test.ts`

**Interfaces:**
- Consumes: `MemoryRow` from `storage.ts`, `MyMoreConfig` from `config.ts`
- Produces:
  - `class EmbeddingClient { constructor(cfg: { baseUrl: string; apiKey: string; model: string }); async embed(text: string): Promise<Float32Array>; async embedBatch(texts: string[]): Promise<Float32Array[]> }` — calls `${baseUrl}/embeddings` (OpenAI-compatible: `{model, input: text[]}`), returns `data[].embedding`.
  - `class VectorStore { constructor(dbPath: string, dims: number); ensureSchema(): void; upsert(recordId: string, vec: Float32Array): void; remove(recordId: string): void; search(vec: Float32Array, topK: number): Array<{ record_id: string; score: number }>; close(): void }` — `sqlite-vec` virtual table `vec_items(record_id TEXT PRIMARY KEY, embedding FLOAT[...])`, cosine via `vec_distance_cosine`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/vector.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { VectorStore } from '../src/vector.js';

describe('VectorStore', () => {
  let dir: string; let store: VectorStore;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'vec-test-'));
    store = new VectorStore(join(dir, 'vec.db'), 3);
  });
  afterAll(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });

  it('upserts and searches by cosine', () => {
    store.upsert('rec_a', new Float32Array([1, 0, 0]));
    store.upsert('rec_b', new Float32Array([0, 1, 0]));
    const hits = store.search(new Float32Array([1, 0, 0]), 2);
    expect(hits[0].record_id).toBe('rec_a');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('removes a record', () => {
    store.remove('rec_b');
    const hits = store.search(new Float32Array([0, 1, 0]), 5);
    expect(hits.map(h => h.record_id)).not.toContain('rec_b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/vector.test.ts`
Expected: FAIL — module `../src/vector.js` not found.

- [ ] **Step 3: Install sqlite-vec**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && pnpm add sqlite-vec@0.1.9`

- [ ] **Step 4: Implement vector.ts**

`VectorStore`:
- Open better-sqlite3, `db.loadExtension(require('sqlite-vec').getLoadablePath())` (or the documented init for the version).
- `ensureSchema`: `CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(record_id TEXT PRIMARY KEY, embedding FLOAT[${dims}])`.
- `upsert`: `INSERT OR REPLACE INTO vec_items(record_id, embedding) VALUES (?, ?)` (bind Float32Array).
- `remove`: `DELETE FROM vec_items WHERE record_id = ?`.
- `search`: `SELECT record_id, vec_distance_cosine(embedding, ?) AS distance FROM vec_items WHERE embedding MATCH ? AND k = ?` → score = `1 - distance`.
- `close`: `db.close()`.

`EmbeddingClient.embed`:
- POST `${baseUrl}/embeddings` with `{ model, input: text }`, `Authorization: Bearer ${apiKey}`.
- Return `new Float32Array(data[0].embedding)`.
- `embedBatch`: POST `{ model, input: texts }` → map `data`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/vector.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/vector.ts packages/core/test/vector.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): sqlite-vec 向量存储 + EmbeddingClient"
```

---

### Task 6: L1 JSONL writer (records source of truth)

**Files:**
- Create: `packages/core/src/record/l1-writer.ts`
- Test: `packages/core/test/l1-writer.test.ts`

**Interfaces:**
- Consumes: `MemoryRow` fields from Task 2
- Produces:
  - `interface L1Record { id: string; type: 'persona'|'episodic'|'instruction'|'work_fact'|'work_task'|'work_method'|'work_artifact'; content: string; priority: number; scene_name?: string; source_message_ids: string[]; created_at: string; version: number; team?: string; agent?: string }`
  - `generateMemoryId(): string` — `rec_${Date.now()}_${randomBytes(3).hex}`
  - `appendL1Record(record: L1Record, baseDir: string, team?: string, agent?: string): string` — appends to `records/YYYY-MM-DD.jsonl` (all teams merged, line-filtered by team/agent at read), returns id
  - `readL1Records(baseDir: string, opts?: { afterVersion?: number; team?: string; agent?: string; limit?: number }): L1Record[]`
  - `getL1Record(id: string, baseDir: string): L1Record | null`

- [ ] **Step 1: Write the failing test**

`packages/core/test/l1-writer.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendL1Record, readL1Records, getL1Record, generateMemoryId } from '../src/record/l1-writer.js';

describe('L1 writer', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l1-test-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('appends and reads back', () => {
    const rec = {
      id: generateMemoryId(), type: 'episodic' as const,
      content: '用户确认方案A', priority: 82, scene_name: '做改造设计',
      source_message_ids: ['msg_1'], created_at: new Date().toISOString(),
      version: 2, team: 'dante', agent: 'arch',
    };
    const id = appendL1Record(rec, dir);
    const all = readL1Records(dir, { team: 'dante' });
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(id);
    expect(all[0].priority).toBe(82);
    expect(getL1Record(id, dir)!.type).toBe('episodic');
  });

  it('filters by team', () => {
    appendL1Record({ ...base(), team: 'other' }, dir);
    const mine = readL1Records(dir, { team: 'dante' });
    const all = readL1Records(dir);
    expect(mine).toHaveLength(1);
    expect(all).toHaveLength(2);
  });
});
```
Add a `base()` helper returning a valid record.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-writer.test.ts`
Expected: FAIL — module `../src/record/l1-writer.js` not found.

- [ ] **Step 3: Implement l1-writer.ts**

- `appendL1Record`: mkdir `${baseDir}/records`, append `JSON.stringify(record) + '\n'` to `${baseDir}/records/${YYYY-MM-DD}.jsonl`, return `record.id`.
- `readL1Records`: read all daily files sorted, parse each line, filter by `team`/`agent` if provided, filter by `afterVersion` (record.version > afterVersion), truncate to newest `limit`. Sort by `created_at` desc.
- `getL1Record`: linear scan (records are small at this stage; optimize later).
- `generateMemoryId`: `rec_${Date.now()}_${randomBytes(3).toString('hex')}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-writer.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/record/l1-writer.ts packages/core/test/l1-writer.test.ts
git commit -m "feat(core): L1 JSONL 写入器 (真源, 结构化记录)"
```

---

### Task 7: Dual-write facade — cascade memory into index

**Files:**
- Create: `packages/core/src/record/dual-writer.ts`
- Test: `packages/core/test/dual-writer.test.ts`

**Interfaces:**
- Consumes: `appendL1Record` (Task 6), `MemoryStorage` (Task 2), `VectorStore` + `EmbeddingClient` (Task 5)
- Produces:
  - `class DualWriter { constructor(opts: { storage: MemoryStorage; vector: VectorStore; embed: EmbeddingClient; baseDir: string; team?: string; agent?: string }); async storeL1(record: L1Record): Promise<{ id: string }>; async deprecateL1(id: string): Promise<void> }`
  - `storeL1`: append JSONL (source of truth), upsert memory_meta row, embed content → upsert vector. For `version > 1`, first `remove()` old vector.
  - `deprecateL1`: mark `superseded_by` in memory_meta + `remove()` vector.

- [ ] **Step 1: Write the failing test**

`packages/core/test/dual-writer.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { VectorStore, EmbeddingClient } from '../src/vector.js';
import { DualWriter } from '../src/record/dual-writer.js';
import type { L1Record } from '../src/record/l1-writer.js';

describe('DualWriter', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  let fakeEmbed: EmbeddingClient;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dual-test-'));
    storage = new MemoryStorage(join(dir, 'memory.db'));
    vector = new VectorStore(join(dir, 'vec.db'), 3);
    fakeEmbed = {
      embed: async (t: string) => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0]),
      embedBatch: async (ts: string[]) => ts.map(t => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0])),
    } as unknown as EmbeddingClient;
  });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  const rec = (id: string, content: string, v: number): L1Record => ({
    id, type: 'episodic', content, priority: 80,
    source_message_ids: [], created_at: new Date().toISOString(), version: v,
  });

  it('writes JSONL + meta + vector', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_1', '方案A', 1));
    expect(storage.getById('rec_1')!.type).toBe('episodic');
    expect(storage.getById('rec_1')!.team).toBe('dante');
    const hits = vector.search(new Float32Array([1,0,0]), 5);
    expect(hits.map(h => h.record_id)).toContain('rec_1');
  });

  it('version>1 removes old vector, keeps new', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_2', '方案A', 1));
    await w.storeL1(rec('rec_2', '方案B(更新)', 2));
    const hits = vector.search(new Float32Array([1,0,0]), 10);
    expect(hits.map(h => h.record_id)).not.toContain('rec_2');
    const hitsB = vector.search(new Float32Array([0,1,0]), 10);
    expect(hitsB.map(h => h.record_id)).toContain('rec_2');
  });

  it('deprecate removes vector', async () => {
    const w = new DualWriter({ storage, vector, embed: fakeEmbed, baseDir: dir, team: 'dante', agent: 'arch' });
    await w.storeL1(rec('rec_3', '方案A', 1));
    await w.deprecateL1('rec_3');
    const hits = vector.search(new Float32Array([1,0,0]), 10);
    expect(hits.map(h => h.record_id)).not.toContain('rec_3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/dual-writer.test.ts`
Expected: FAIL — module `../src/record/dual-writer.js` not found.

- [ ] **Step 3: Implement dual-writer.ts**

```ts
export class DualWriter {
  constructor(private opts: { storage: MemoryStorage; vector: VectorStore; embed: EmbeddingClient; baseDir: string; team?: string; agent?: string }) {}

  async storeL1(record: L1Record): Promise<{ id: string }> {
    const { storage, vector, embed, baseDir, team, agent } = this.opts;
    appendL1Record({ ...record, team: record.team ?? team, agent: record.agent ?? agent }, baseDir);
    if (record.version > 1) vector.remove(record.id);
    const vec = await embed.embed(record.content);
    vector.upsert(record.id, vec);
    storage.add({
      id: record.id, track: 'user', owner_id: agent ?? 'default', category: 'persistent',
      content: record.content, created_at: record.created_at, frozen: record.priority >= 90,
      access_count: 0, type: record.type, priority: record.priority,
      scene_name: record.scene_name, version: record.version,
      source_message_ids: JSON.stringify(record.source_message_ids), team, agent,
    });
    return { id: record.id };
  }

  async deprecateL1(id: string): Promise<void> {
    this.opts.storage.updateRow(id, { category: 'archived', frozen: 0 } as any);
    this.opts.vector.remove(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/dual-writer.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/record/dual-writer.ts packages/core/test/dual-writer.test.ts
git commit -m "feat(core): DualWriter 双写 (JSONL真源 + meta索引 + 向量)"
```

---

### Task 8: Export from @mymore/core index + run full test suite

**Files:**
- Modify: `packages/core/src/index.ts` (export new modules)
- Modify: `packages/core/package.json` (ensure `sqlite-vec` dep recorded)

**Interfaces:**
- Produces: `index.ts` re-exports `recordConversation`, `readConversationMessages`, `L0MessageRecord`, `loadConfig`, `saveConfig`, `MyMoreConfig`, `EmbeddingClient`, `VectorStore`, `appendL1Record`, `readL1Records`, `getL1Record`, `generateMemoryId`, `L1Record`, `DualWriter`.

- [ ] **Step 1: Add exports**

In `packages/core/src/index.ts`, add:
```ts
export { recordConversation, readConversationMessages } from './conversation/l0-recorder.js';
export type { L0MessageRecord } from './conversation/l0-recorder.js';
export { loadConfig, saveConfig } from './config.js';
export type { MyMoreConfig } from './config.js';
export { EmbeddingClient, VectorStore } from './vector.js';
export { appendL1Record, readL1Records, getL1Record, generateMemoryId } from './record/l1-writer.js';
export type { L1Record } from './record/l1-writer.js';
export { DualWriter } from './record/dual-writer.js';
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run`
Expected: ALL tests pass (existing + new).

- [ ] **Step 3: Verify build**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && pnpm build`
Expected: father build succeeds (cjs + esm).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts packages/core/package.json
git commit -m "feat(core): 导出 L0/L1/vector/config/DualWriter 新模块"
```
