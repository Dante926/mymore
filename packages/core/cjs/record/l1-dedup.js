var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/record/l1-dedup.ts
var l1_dedup_exports = {};
__export(l1_dedup_exports, {
  applyDecisions: () => applyDecisions,
  batchDedup: () => batchDedup,
  parseDedupDecisions: () => parseDedupDecisions
});
module.exports = __toCommonJS(l1_dedup_exports);
var import_dual_writer = require("./dual-writer.js");
var import_l1_dedup = require("../prompts/l1-dedup.js");
var VALID_TYPES = [
  "persona",
  "episodic",
  "instruction",
  "work_fact",
  "work_task",
  "work_method",
  "work_artifact"
];
async function batchDedup(params) {
  const {
    memories,
    llm,
    vector,
    embed,
    storage,
    conflictRecallTopK = 5,
    team,
    agent
  } = params;
  if (memories.length === 0)
    return [];
  const storeAll = () => memories.map((m) => ({ record_id: m.record_id, action: "store", target_ids: [] }));
  const storageHasL1 = storageHasRecords(storage);
  const hasVectorTier = Boolean(vector && embed) && storageHasL1;
  const hasFtsTier = storageHasL1;
  if (!hasVectorTier && !hasFtsTier) {
    return storeAll();
  }
  let matches;
  try {
    if (hasVectorTier) {
      matches = await findCandidatesByVector(memories, vector, embed, storage, conflictRecallTopK, { team, agent });
    } else {
      matches = await findCandidatesByFts(memories, storage, { team, agent });
    }
  } catch (err) {
    console.warn(
      `[l1-dedup] candidate recall failed, all store: ${err instanceof Error ? err.message : String(err)}`
    );
    return storeAll();
  }
  try {
    const raw = await llm.run({
      prompt: (0, import_l1_dedup.formatBatchConflictPrompt)(matches),
      systemPrompt: import_l1_dedup.CONFLICT_DETECTION_SYSTEM_PROMPT,
      taskId: "l1-conflict-detection",
      timeoutMs: 18e4
    });
    return parseDedupDecisions(raw, memories);
  } catch (err) {
    console.warn(
      `[l1-dedup] LLM conflict detection failed, all store: ${err instanceof Error ? err.message : String(err)}`
    );
    return storeAll();
  }
}
function storageHasRecords(storage) {
  try {
    return storage.search(void 0, { limit: 20 }).length > 0;
  } catch {
    return false;
  }
}
async function findCandidatesByVector(memories, vector, embed, storage, topK, isolation) {
  const newRecordIds = new Set(memories.map((m) => m.record_id));
  const embeddings = await embed.embedBatch(memories.map((m) => m.content));
  const matches = [];
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const queryVec = embeddings[i];
    const searchResults = vector.search(queryVec, topK + memories.length);
    const candidates = [];
    for (const hit of searchResults) {
      if (candidates.length >= topK)
        break;
      if (newRecordIds.has(hit.record_id))
        continue;
      if ((hit.score ?? 0) <= 0.3)
        continue;
      const row = storage.getById(hit.record_id);
      if (!row)
        continue;
      if (isolation.team !== void 0 && row.team !== isolation.team)
        continue;
      if (isolation.agent !== void 0 && row.agent !== isolation.agent)
        continue;
      candidates.push(rowToL1Record(row, storage));
    }
    matches.push({ newMemory: mem, candidates });
  }
  return matches;
}
async function findCandidatesByFts(memories, storage, isolation) {
  const newRecordIds = new Set(memories.map((m) => m.record_id));
  const matches = [];
  for (const mem of memories) {
    const searchTerm = makeFtsSearchTerm(mem.content, isolation);
    const results = storage.search(searchTerm, { limit: 10 });
    const candidates = [];
    for (const r of results) {
      if (candidates.length >= 5)
        break;
      if (newRecordIds.has(r.id))
        continue;
      const row = storage.getById(r.id);
      if (!row)
        continue;
      if (isolation.team !== void 0 && row.team !== isolation.team)
        continue;
      if (isolation.agent !== void 0 && row.agent !== isolation.agent)
        continue;
      candidates.push(rowToL1Record(row, storage));
    }
    matches.push({ newMemory: mem, candidates });
  }
  return matches;
}
function makeFtsSearchTerm(content, isolation) {
  if (isolation.team !== void 0 || isolation.agent !== void 0) {
    return "mymore-no-cross-tenant";
  }
  return content;
}
function parseDedupDecisions(raw, memories) {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    const arrayJson = extractFirstJsonArray(cleaned);
    if (arrayJson === null)
      return storeAllFallback(memories);
    const sanitized = sanitizeJsonForParse(arrayJson);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const repaired = repairDedupJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!Array.isArray(parsed))
      return storeAllFallback(memories);
    const validActions = ["store", "update", "merge", "skip"];
    const decisions = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object")
        continue;
      const d = item;
      const recordId = String(d.record_id ?? "");
      if (!recordId)
        continue;
      const rawAction = String(d.action ?? "store");
      const action = validActions.includes(rawAction) ? rawAction : "store";
      decisions.push({
        record_id: recordId,
        action,
        target_ids: Array.isArray(d.target_ids) ? d.target_ids.map(String) : [],
        merged_content: typeof d.merged_content === "string" ? d.merged_content : void 0,
        merged_type: VALID_TYPES.includes(d.merged_type) ? d.merged_type : void 0,
        merged_priority: typeof d.merged_priority === "number" ? d.merged_priority : void 0,
        merged_timestamps: Array.isArray(d.merged_timestamps) ? d.merged_timestamps.map(String) : void 0
      });
    }
    const decidedIds = new Set(decisions.map((d) => d.record_id));
    for (const mem of memories) {
      if (!decidedIds.has(mem.record_id)) {
        decisions.push({ record_id: mem.record_id, action: "store", target_ids: [] });
      }
    }
    return decisions;
  } catch (err) {
    console.warn(
      `[l1-dedup] parse failed, all store: ${err instanceof Error ? err.message : String(err)}`
    );
    return storeAllFallback(memories);
  }
}
function storeAllFallback(memories) {
  return memories.map((m) => ({ record_id: m.record_id, action: "store", target_ids: [] }));
}
function extractFirstJsonArray(raw) {
  const start = raw.indexOf("[");
  if (start === -1)
    return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0)
        return raw.slice(start, i + 1);
    }
  }
  return null;
}
function sanitizeJsonForParse(raw) {
  const escaped = escapeControlCharsInJsonStrings(raw);
  try {
    JSON.parse(escaped);
    return escaped;
  } catch {
    return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  }
}
function escapeControlCharsInJsonStrings(raw) {
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (ch === "\\") {
        out += ch + (raw[i + 1] ?? "");
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 32) {
        switch (ch) {
          case "\n":
            out += "\\n";
            break;
          case "\r":
            out += "\\r";
            break;
          case "	":
            out += "\\t";
            break;
          case "\b":
            out += "\\b";
            break;
          case "\f":
            out += "\\f";
            break;
          default:
            out += `\\u${code.toString(16).padStart(4, "0")}`;
        }
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}
function repairDedupJson(json) {
  return json.replace(/,\s*([}\]])/g, "$1");
}
async function applyDecisions(params) {
  const {
    memories,
    decisions,
    storage,
    vector,
    embed,
    baseDir,
    team,
    agent
  } = params;
  const writer = new import_dual_writer.DualWriter({ storage, vector, embed, baseDir, team, agent });
  const decisionByRecord = /* @__PURE__ */ new Map();
  for (const d of decisions) {
    if (!decisionByRecord.has(d.record_id))
      decisionByRecord.set(d.record_id, d);
  }
  const written = [];
  for (const memory of memories) {
    const decision = decisionByRecord.get(memory.record_id);
    if (!decision || decision.action === "skip")
      continue;
    if (decision.action === "store") {
      const stored = await writer.storeL1({ ...memory, version: memory.version });
      written.push({ ...memory, version: memory.version });
      continue;
    }
    const validTargets = validateTargets(memory, decision.target_ids ?? [], storage, team, agent);
    const content = decision.merged_content ?? memory.content;
    const type = normalizeMergedType(decision.merged_type) ?? memory.type;
    const mergedPriority = decision.merged_priority;
    let maxVersion = memory.version;
    for (const target of validTargets) {
      if (typeof target.version === "number" && target.version > maxVersion) {
        maxVersion = target.version;
      }
    }
    const newVersion = maxVersion + 1;
    const mergedRecord = {
      ...memory,
      id: memory.id,
      type,
      content,
      priority: mergedPriority ?? memory.priority,
      version: newVersion
    };
    await writer.storeL1(mergedRecord);
    for (const target of validTargets) {
      storage.markSuperseded(target.id, memory.id);
      vector.remove(target.id);
    }
    written.push(mergedRecord);
  }
  return written;
}
function validateTargets(memory, targetIds, storage, team, agent) {
  const effectiveTeam = memory.team ?? team;
  const effectiveAgent = memory.agent ?? agent;
  const valid = [];
  for (const targetId of targetIds) {
    if (!targetId || targetId === memory.id)
      continue;
    const row = storage.getById(targetId);
    if (!row)
      continue;
    if ((row.team ?? void 0) !== (effectiveTeam ?? void 0))
      continue;
    if ((row.agent ?? void 0) !== (effectiveAgent ?? void 0))
      continue;
    valid.push({ id: row.id, version: row.version });
  }
  return valid;
}
function normalizeMergedType(raw) {
  if (!raw)
    return null;
  const lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower))
    return lower;
  if (lower === "episode")
    return "episodic";
  if (lower === "instruct")
    return "instruction";
  if (lower === "preference")
    return "persona";
  return null;
}
function rowToL1Record(row, storage) {
  return {
    id: row.id,
    type: normalizeMergedType(row.type ?? "") ?? "episodic",
    content: storage.getContentById(row.id) ?? "",
    priority: typeof row.priority === "number" ? row.priority : 50,
    scene_name: row.scene_name ?? void 0,
    source_message_ids: parseSourceMessageIds(row.source_message_ids),
    created_at: row.created_at,
    version: typeof row.version === "number" ? row.version : 1,
    team: row.team ?? void 0,
    agent: row.agent ?? void 0
  };
}
function parseSourceMessageIds(raw) {
  if (!raw)
    return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.map(String);
  } catch {
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyDecisions,
  batchDedup,
  parseDedupDecisions
});
