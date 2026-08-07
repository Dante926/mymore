# Plan 3: L1 记忆提取管线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the L1 extraction pipeline: LLMRunner (hosted OpenAI-compatible endpoint), strict-JSON memory extraction with parsing tolerance, and LLM-judged dedup (store/skip/update/merge) — the "structured memory + second review" core of the L0→L3 design.

**Architecture:** New modules in `@mymore/core`: `llm.ts` (LLMRunner calling the hosted endpoint), `record/l1-extractor.ts` (extraction prompt + parse tolerance), `record/l1-dedup.ts` (candidate recall + LLM batch judgment). mcp-server's PipelineManager `onL1Ready` wires to an `L1Runner` that reads L0 increments, extracts, dedups, and dual-writes via the existing `DualWriter`. All per reference `TDB/memory-pipeline.md` §3.2-3.5.

**Tech Stack:** TypeScript, Node fetch (hosted endpoint), `@mymore/core` (L0 reader, DualWriter, VectorStore, EmbeddingClient, config), vitest.

## Global Constraints

- Node >= 22.14. LLM calls via Node built-in `fetch` — NO new deps for the LLM client.
- LLM config from `~/.mymore/config.json` via `loadConfig` (already built): `llm.baseUrl`, `llm.apiKey`, `llm.model`, `llm.embeddingModel?`.
- **Extraction is one LLM call doing scene segmentation + memory extraction + JSON output** (reference §3.2). Not free-form summarization.
- Strict JSON contract: `[{scene_name, message_ids, memories:[{content, type, priority, source_message_ids, metadata}]}]`. Empty result allowed (scene + `memories: []`).
- **Parsing tolerance** (reference §3.4): strip code fences → extract first `[...]` → sanitize control chars → repair bare identifiers/trailing commas (retry once) → per-field defaults (never drop the whole batch on one bad field).
- **Dedup is a second LLM review** (reference §3.5): candidate recall (vector → FTS → storeAll fallback) then LLM batch judgment `store/skip/update/merge`. Never cross tenant (filter by team/agent).
- **Dual-write via existing `DualWriter`**: JSONL source of truth + VectorStore index. `update/merge` → remove old vector, version++.
- Tests use `mkdtempSync(tmpdir())` + fake LLM/embed responses; never touch `~/.mymore` or make real LLM calls.
- TDD: write failing test → verify fail → implement → verify pass → commit. Commit per task.

---

### Task 1: LLMRunner

**Files:**
- Create: `packages/core/src/llm.ts`
- Test: `packages/core/test/llm.test.ts`

**Interfaces:**
- Consumes: `MyMoreConfig` from `config.ts`
- Produces:
  - `interface LLMRunParams { prompt: string; systemPrompt?: string; taskId: string; timeoutMs?: number; maxTokens?: number }`
  - `class LLMRunner { constructor(cfg: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number }); async run(params: LLMRunParams): Promise<string>; }`
  - `run` POSTs `${baseUrl}/chat/completions` with `{model, messages: [{role:'system', content: systemPrompt}, {role:'user', content: prompt}], max_tokens}`, Bearer auth, returns `choices[0].message.content`. Non-2xx throws with status. Timeout via AbortController.

- [ ] **Step 1: Write the failing test**

`packages/core/test/llm.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/llm.test.ts`
Expected: FAIL — module `../src/llm.js` not found.

- [ ] **Step 3: Implement llm.ts**

```ts
export interface LLMRunParams {
  prompt: string;
  systemPrompt?: string;
  taskId: string;
  timeoutMs?: number;
  maxTokens?: number;
}

export class LLMRunner {
  constructor(private cfg: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number }) {}

  async run(params: LLMRunParams): Promise<string> {
    const messages = [];
    if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
    messages.push({ role: 'user', content: params.prompt });

    const timeoutMs = params.timeoutMs ?? this.cfg.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`LLM request failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
      }
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/llm.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/llm.ts packages/core/test/llm.test.ts
git commit -m "feat(core): LLMRunner — 调托管 OpenAI 兼容端点 (chat/completions)"
```

---

### Task 2: L1 extraction prompt + parse tolerance

**Files:**
- Create: `packages/core/src/prompts/l1-extraction.ts`
- Create: `packages/core/src/record/l1-extractor.ts`
- Test: `packages/core/test/l1-extractor.test.ts`

**Interfaces:**
- Consumes: `LLMRunner` (Task 1), `ConversationMessage` from `l0-recorder.ts`
- Produces:
  - `EXTRACT_MEMORIES_SYSTEM_PROMPT` (string, chat version per reference §3.2)
  - `formatExtractionPrompt(params: { newMessages: ConversationMessage[]; backgroundMessages?: ConversationMessage[]; previousSceneName?: string }): string`
  - `interface SceneSegment { scene_name: string; message_ids: string[]; memories: Array<{ content: string; type: string; priority: number; source_message_ids: string[]; metadata: Record<string, unknown> }> }`
  - `extractL1Memories(params: { messages: ConversationMessage[]; llm: LLMRunner; baseDir: string; sessionKey: string; maxMessagesPerExtraction?: number; maxBackgroundMessages?: number; maxMemoriesPerSession?: number }): Promise<L1ExtractionResult>`
  - `interface L1ExtractionResult { success: boolean; extractedCount: number; storedCount: number; records: L1Record[]; sceneNames: string[]; lastSceneName?: string }`

- [ ] **Step 1: Write the failing test**

`packages/core/test/l1-extractor.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-extractor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement prompts/l1-extraction.ts**

Copy `EXTRACT_MEMORIES_SYSTEM_PROMPT` from reference `memory-pipeline.md` §3.2 (the chat version: role "情境切分与记忆提取专家", three types persona/episodic/instruction with priority rules, exclusion list, JSON output contract, empty-result allowed). Also `formatExtractionPrompt` per §3.2 (backgroundMessages as context only, never extracted; newMessages as the extraction source).

- [ ] **Step 4: Implement record/l1-extractor.ts**

- Split `messages` into `newMessages` (last `maxMessagesPerExtraction`=10) + `backgroundMessages` (preceding up to 5).
- `callLlmExtraction`: build prompts, call `llm.run({ prompt, systemPrompt: EXTRACT_MEMORIES_SYSTEM_PROMPT, taskId: 'l1-extraction', timeoutMs: 180_000 })`.
- `parseExtractionResult`: strip code fences → regex extract first `[...]` → sanitize control chars → JSON.parse with repair fallback (bare identifier → 50, trailing comma) retry once → per-field defaults (scene_name default "未知情境", type default "episodic", priority default 50, source_message_ids [], metadata {}) → `normalizeType` (7 valid types + legacy aliases episode→episodic, instruct→instruction, preference→persona; invalid → skip).
- Build `L1Record[]` from extracted memories (id via `generateMemoryId`), write via `appendL1Record` (source of truth), return result.
- LLM throws → `success:false`, all 0. `maxMemoriesPerSession`=10 truncation.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-extractor.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/prompts/l1-extraction.ts packages/core/src/record/l1-extractor.ts packages/core/test/l1-extractor.test.ts
git commit -m "feat(core): L1 提取 — 情境切分+记忆提取+JSON 契约 + 解析容错"
```

---

### Task 3: L1 dedup (candidate recall + LLM judgment)

**Files:**
- Create: `packages/core/src/prompts/l1-dedup.ts`
- Create: `packages/core/src/record/l1-dedup.ts`
- Test: `packages/core/test/l1-dedup.test.ts`

**Interfaces:**
- Consumes: `LLMRunner` (Task 1), `VectorStore` + `EmbeddingClient` from `vector.ts`, `MemoryStorage` from `storage.ts`, `L1Record` from `l1-writer.ts`
- Produces:
  - `CONFLICT_DETECTION_SYSTEM_PROMPT` (string, per reference §3.5)
  - `formatBatchConflictPrompt(matches: CandidateMatch[]): string` (unified candidate pool + per-memory candidate IDs)
  - `interface DedupDecision { record_id: string; action: 'store'|'skip'|'update'|'merge'; target_ids: string[]; merged_content?: string; merged_type?: string; merged_priority?: number; merged_timestamps?: string[] }`
  - `batchDedup(params: { memories: Array<L1Record & { record_id: string }>; llm: LLMRunner; vector?: VectorStore; embed?: EmbeddingClient; storage: MemoryStorage; conflictRecallTopK?: number; team?: string; agent?: string }): Promise<DedupDecision[]>`
  - `applyDecisions(params: { memories; decisions; storage; vector; embed; baseDir; team?; agent? }): Promise<L1Record[]>` — applies decisions via DualWriter: skip → nothing; store → DualWriter.storeL1; update/merge → remove old vector, DualWriter.storeL1 with version = max+1.

- [ ] **Step 1: Write the failing test**

`packages/core/test/l1-dedup.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage } from '../src/storage.js';
import { VectorStore, EmbeddingClient } from '../src/vector.js';
import { LLMRunner } from '../src/llm.js';
import { batchDedup, applyDecisions } from '../src/record/l1-dedup.js';
import type { L1Record } from '../src/record/l1-writer.js';

describe('L1 dedup', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  const fakeEmbed = {
    embed: async (t: string) => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0]),
    embedBatch: async (ts: string[]) => ts.map(t => new Float32Array(t.includes('A') ? [1,0,0] : [0,1,0])),
  } as unknown as EmbeddingClient;
  const fakeLlm = (output: string) => ({ run: async () => output }) as unknown as LLMRunner;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'l1dedup-'));
    storage = new MemoryStorage(join(dir, 'mem.db'));
    vector = new VectorStore(join(dir, 'vec.db'), 3);
  });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  const rec = (id: string, content: string): L1Record & { record_id: string } => ({
    id, record_id: id, type: 'episodic', content, priority: 80,
    source_message_ids: [], created_at: new Date().toISOString(), version: 1,
  });

  it('llm returns store decisions, applyDecisions writes them', async () => {
    const llm = fakeLlm(JSON.stringify([{ record_id: 'r1', action: 'store', target_ids: [] }]));
    const decisions = await batchDedup({ memories: [rec('r1', '方案A')], llm, vector, embed: fakeEmbed, storage });
    expect(decisions[0].action).toBe('store');
    await applyDecisions({ memories: [rec('r1', '方案A')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    expect(storage.getById('r1')).not.toBeNull();
  });

  it('skip decision writes nothing', async () => {
    const llm = fakeLlm(JSON.stringify([{ record_id: 'r2', action: 'skip', target_ids: [] }]));
    const decisions = await batchDedup({ memories: [rec('r2', '旧信息')], llm, vector, embed: fakeEmbed, storage });
    await applyDecisions({ memories: [rec('r2', '旧信息')], decisions, storage, vector, embed: fakeEmbed, baseDir: dir });
    expect(storage.getById('r2')).toBeNull();
  });

  it('no recall capability → storeAll (fallback)', async () => {
    const llm = fakeLlm('') ; // llm never called
    const decisions = await batchDedup({ memories: [rec('r3', 'x')], llm, storage }); // no vector/embed
    expect(decisions[0].action).toBe('store');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-dedup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement prompts/l1-dedup.ts**

Copy `CONFLICT_DETECTION_SYSTEM_PROMPT` + `formatBatchConflictPrompt` from reference §3.5 (unified candidate pool, four actions store/skip/update/merge, cross-type merge, multi-target, merged_priority rules, JSON output contract).

- [ ] **Step 4: Implement record/l1-dedup.ts**

- `batchDedup`: 
  - Candidate recall (3-tier): if vector+embed available and storage has L1 records → embed each new memory content, `vector.search` topK (fetch topK+len to offset self-match), filter to distinct existing records → Tier 1. Else if storage has FTS data → `storage.search(memory.content, {limit:10})` → Tier 2. Else → `storeAll()` (skip dedup).
  - If recall found candidates → `formatBatchConflictPrompt` → `llm.run` with `CONFLICT_DETECTION_SYSTEM_PROMPT` → `parseDedupDecisions` (parse tolerance like extraction: strip fences, extract array, per-field defaults).
  - `filter` by team/agent when provided (never cross tenant).
- `applyDecisions`: for each memory, look up decision; skip → nothing; store → `DualWriter.storeL1({...memory, version: memory.version})`; update/merge → `vector.remove(target)` for each target_id, then `DualWriter.storeL1({...memory, content: merged_content ?? memory.content, type: merged_type as any ?? memory.type, version: maxVersion+1})`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run test/l1-dedup.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/prompts/l1-dedup.ts packages/core/src/record/l1-dedup.ts packages/core/test/l1-dedup.test.ts
git commit -m "feat(core): L1 去重 — 候选召回(向量/FTS) + LLM 批量判定(store/skip/update/merge)"
```

---

### Task 4: Export new modules from @mymore/core

**Files:**
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: exports `LLMRunner`, `LLMRunParams`, `extractL1Memories`, `SceneSegment`, `L1ExtractionResult`, `EXTRACT_MEMORIES_SYSTEM_PROMPT`, `formatExtractionPrompt`, `batchDedup`, `applyDecisions`, `DedupDecision`, `CONFLICT_DETECTION_SYSTEM_PROMPT`.

- [ ] **Step 1: Add exports**

```ts
export { LLMRunner } from './llm.js';
export type { LLMRunParams } from './llm.js';
export { extractL1Memories } from './record/l1-extractor.js';
export type { SceneSegment, L1ExtractionResult } from './record/l1-extractor.js';
export { EXTRACT_MEMORIES_SYSTEM_PROMPT, formatExtractionPrompt } from './prompts/l1-extraction.js';
export { batchDedup, applyDecisions } from './record/l1-dedup.js';
export type { DedupDecision } from './record/l1-dedup.js';
export { CONFLICT_DETECTION_SYSTEM_PROMPT } from './prompts/l1-dedup.js';
```

- [ ] **Step 2: Run full core suite**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run`
Expected: ALL tests pass (existing + new).

- [ ] **Step 3: Build core**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && pnpm build`
Expected: father build succeeds (esm + cjs).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): 导出 LLMRunner/L1 extractor/L1 dedup 新模块"
```

---

### Task 5: Wire L1 into mcp-server PipelineManager

**Files:**
- Modify: `apps/mcp-server/src/bootstrap.ts`
- Modify: `apps/mcp-server/src/pipeline-manager.ts` (onL1Ready real implementation)
- Create: `apps/mcp-server/src/l1-runner.ts`
- Test: `apps/mcp-server/test/l1-runner.test.ts`

**Interfaces:**
- Consumes: `readConversationMessages` from `@mymore/core`, `extractL1Memories`, `batchDedup`, `applyDecisions`, `DualWriter`, `MemoryStorage`, `VectorStore`, `EmbeddingClient`, `LLMRunner`, `loadConfig`
- Produces:
  - `class L1Runner { constructor(opts: { baseDir: string; sessionKey: string; llm: LLMRunner; storage: MemoryStorage; vector: VectorStore; embed: EmbeddingClient; lastL1Timestamp: number }); async run(): Promise<{ extracted: number; stored: number }> }`
  - `run()` reads L0 messages since `lastL1Timestamp`, filters through `extractL1Memories` + `batchDedup` + `applyDecisions` (dual-write), updates `lastL1Timestamp`.
  - PipelineManager's `onL1Ready` now calls `l1Runner.run()` instead of logging.

- [ ] **Step 1: Write the failing test**

`apps/mcp-server/test/l1-runner.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryStorage, VectorStore, EmbeddingClient, LLMRunner, recordConversation, DualWriter } from '@mymore/core';
import { L1Runner } from '../src/l1-runner.js';

describe('L1Runner', () => {
  let dir: string; let storage: MemoryStorage; let vector: VectorStore;
  const fakeEmbed = { embed: async (t: string) => new Float32Array([1,0,0]), embedBatch: async (ts: string[]) => ts.map(() => new Float32Array([1,0,0])) } as unknown as EmbeddingClient;
  const fakeLlm = (output: string) => ({ run: async () => output }) as unknown as LLMRunner;

  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l1run-')); storage = new MemoryStorage(join(dir, 'mem.db')); vector = new VectorStore(join(dir, 'vec.db'), 3); });
  afterAll(() => { storage.close(); vector.close(); rmSync(dir, { recursive: true, force: true }); });

  it('reads L0 increment and extracts to L1', async () => {
    await recordConversation({ sessionKey: 'projA', baseDir: dir, messages: [{ role: 'user', content: '用户：我用 Rust 写后端', timestamp: 1000 }] });
    const llm = fakeLlm(JSON.stringify([{ scene_name: '技术栈', message_ids: [], memories: [{ content: '用户用 Rust 写后端', type: 'persona', priority: 90, source_message_ids: [], metadata: {} }] }]));
    const runner = new L1Runner({ baseDir: dir, sessionKey: 'projA', llm, storage, vector, embed: fakeEmbed, lastL1Timestamp: 0 });
    const result = await runner.run();
    expect(result.extracted).toBe(1);
    // L1 记录已双写：memory_meta 索引里有 persona 类型的记录（用 content 断言）
    const all = storage.search('Rust', { owner_id: 'default', include_expired: true, limit: 10 });
    expect(all.some(r => r.content.includes('Rust'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run test/l1-runner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement l1-runner.ts**

- Constructor stores opts.
- `run()`: `readConversationMessages(sessionKey, baseDir, lastL1Timestamp)` → if empty return `{extracted:0, stored:0}`. `extractL1Memories({messages, llm, baseDir, sessionKey})` → if `!success` or `extractedCount===0` return counts. `batchDedup` + `applyDecisions` (dual-write via existing DualWriter). Update `lastL1Timestamp` to max message timestamp.
- Handle per-session: use the sessionKey passed to the manager (not hardcoded 'default') — this resolves the Plan 2 I3 seam at the L1Runner level.

- [ ] **Step 4: Wire PipelineManager.onL1Ready**

In `bootstrap.ts`, construct `L1Runner` with real LLM/embed/storage/vector from config; set `pipelineManager.onL1Ready` to call `l1Runner.run()`. Keep the skeleton's threshold/flush behavior; `onL1Ready` now does real L1 work.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run`
Expected: all pass (new + existing).

- [ ] **Step 6: Commit**

```bash
git add apps/mcp-server/src/l1-runner.ts apps/mcp-server/src/pipeline-manager.ts apps/mcp-server/src/bootstrap.ts apps/mcp-server/test/l1-runner.test.ts
git commit -m "feat(mcp): L1Runner 接线 — PipelineManager 触发真实 L1 提取/去重/双写"
```

---

### Task 6: Full-suite verification + doc

**Files:**
- Verify: all packages build + tests pass
- Docs: verification note in the plan doc

**Interfaces:**
- Produces: green full suite, end-to-end L1 pipeline runnable.

- [ ] **Step 1: Build all**

Run: `cd /Users/admin/Desktop/dante926/mymore && pnpm build`
Expected: core (father) + mcp-server (tsup) both succeed.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/admin/Desktop/dante926/mymore/packages/core && npx vitest run` → all pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/apps/mcp-server && npx vitest run` → all pass.
Run: `cd /Users/admin/Desktop/dante926/mymore/hooks && npx vitest run` → all pass.

- [ ] **Step 3: Smoke test end-to-end (optional, manual)**

With a real hosted endpoint configured (or skipped if none), POST a notify and verify L1 extracts + dual-writes. If no endpoint, note it and rely on unit tests.

- [ ] **Step 4: Commit (if any doc changes)**

```bash
git add -A
git commit -m "chore: Plan 3 全量验证 + 构建确认"
```
(If no changes, note it and skip commit.)

---

### Verification note (Task 6, 2026-08-07)

Full-suite verification passed on 2026-08-07:

- **Build:** `pnpm build` → exit 0. `packages/core` via father (esm + cjs, 17 files each), `apps/mcp-server` via tsup (esm → `dist/bootstrap.js`).
- **Tests:** `packages/core` 81/81 (14 files), `apps/mcp-server` 21/21 (7 files), `hooks` 16/16 (3 files).
- **Build-artifact sync:** Plan 3 source changes (storage.ts, conversation/l0-recorder.ts, index.ts exports, new llm.ts, prompts/, record/l1-extractor.ts, record/l1-dedup.ts, record/l1-writer.ts, record/dual-writer.ts) rebuilt into git-tracked `packages/core/esm/` + `packages/core/cjs/` and committed in this task, so `@mymore/core` consumers get the latest code.
- **Host mcp-server:** `node apps/mcp-server/dist/bootstrap.js` starts, listens on 127.0.0.1:3477, `POST /notify` returns `{"ok":true}`, notify fires `[pipeline] L1 ready: session=test extracted=0 stored=0` (no hosted LLM endpoint → extracted/stored 0, expected); SIGTERM → clean exit.
- **Known pre-existing (untouched):** `src/bootstrap.ts` retains the 3 tsc errors from before Plan 3 (reflect_memories/reflect_all null/group_key typing at :248/:313/:320). `scripts/install.sh` working-tree change left uncommitted per task constraint.
