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

// src/record/l1-extractor.ts
var l1_extractor_exports = {};
__export(l1_extractor_exports, {
  extractL1Memories: () => extractL1Memories,
  parseExtractionResult: () => parseExtractionResult
});
module.exports = __toCommonJS(l1_extractor_exports);
var import_l1_extraction = require("../prompts/l1-extraction.js");
var import_l1_writer = require("./l1-writer.js");
async function extractL1Memories(params) {
  const {
    messages,
    llm,
    baseDir,
    sessionKey,
    maxMessagesPerExtraction = 10,
    maxBackgroundMessages = 5,
    maxMemoriesPerSession = 10,
    previousSceneName
  } = params;
  if (messages.length === 0) {
    return { success: true, extractedCount: 0, storedCount: 0, records: [], sceneNames: [] };
  }
  const newMessages = messages.slice(-maxMessagesPerExtraction);
  const bgEndIdx = messages.length - newMessages.length;
  const backgroundMessages = bgEndIdx > 0 ? messages.slice(Math.max(0, bgEndIdx - maxBackgroundMessages), bgEndIdx) : [];
  let scenes;
  try {
    scenes = await callLlmExtraction({ newMessages, backgroundMessages, previousSceneName, llm });
  } catch (err) {
    return { success: false, extractedCount: 0, storedCount: 0, records: [], sceneNames: [] };
  }
  const sceneNames = [];
  const extracted = [];
  for (const scene of scenes) {
    sceneNames.push(scene.scene_name);
    for (const mem of scene.memories) {
      const memType = normalizeType(mem.type);
      if (!memType)
        continue;
      extracted.push({
        content: mem.content,
        type: memType,
        priority: typeof mem.priority === "number" ? mem.priority : 50,
        source_message_ids: Array.isArray(mem.source_message_ids) ? mem.source_message_ids.map(String) : [],
        metadata: mem.metadata && typeof mem.metadata === "object" ? mem.metadata : {},
        scene_name: scene.scene_name
      });
    }
  }
  if (extracted.length > maxMemoriesPerSession) {
    extracted.length = maxMemoriesPerSession;
  }
  const records = [];
  for (const mem of extracted) {
    const record = {
      id: (0, import_l1_writer.generateMemoryId)(),
      type: mem.type,
      content: mem.content,
      priority: mem.priority,
      scene_name: mem.scene_name,
      source_message_ids: mem.source_message_ids,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      version: 1
    };
    try {
      (0, import_l1_writer.appendL1Record)(record, baseDir);
      records.push(record);
    } catch (err) {
      console.warn(
        `[l1-extractor] write failed for memory "${record.content.slice(0, 50)}...": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    success: true,
    extractedCount: extracted.length,
    storedCount: records.length,
    records,
    sceneNames,
    lastSceneName: sceneNames.length > 0 ? sceneNames[sceneNames.length - 1] : void 0
  };
}
async function callLlmExtraction(params) {
  const { newMessages, backgroundMessages, previousSceneName, llm } = params;
  const systemPrompt = import_l1_extraction.EXTRACT_MEMORIES_SYSTEM_PROMPT;
  const prompt = (0, import_l1_extraction.formatExtractionPrompt)({ newMessages, backgroundMessages, previousSceneName });
  const raw = await llm.run({
    prompt,
    systemPrompt,
    taskId: "l1-extraction",
    timeoutMs: 18e4
  });
  return parseExtractionResult(raw);
}
function parseExtractionResult(raw) {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    const arrayJson = extractFirstJsonArray(cleaned);
    if (arrayJson === null)
      return [];
    const sanitized = sanitizeJsonForParse(arrayJson);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const repaired = repairExtractionJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!Array.isArray(parsed))
      return [];
    const scenes = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object")
        continue;
      const s = item;
      scenes.push({
        scene_name: typeof s.scene_name === "string" ? s.scene_name : "未知情境",
        message_ids: Array.isArray(s.message_ids) ? s.message_ids.map(String) : [],
        memories: Array.isArray(s.memories) ? s.memories.filter(
          (m) => m && typeof m === "object" && typeof m.content === "string" && m.content.length > 0
        ).map((m) => ({
          content: String(m.content),
          type: String(m.type ?? "episodic"),
          priority: typeof m.priority === "number" ? m.priority : 50,
          source_message_ids: Array.isArray(m.source_message_ids) ? m.source_message_ids.map(String) : [],
          metadata: m.metadata && typeof m.metadata === "object" ? m.metadata : {}
        })) : []
      });
    }
    return scenes;
  } catch {
    return [];
  }
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
function repairExtractionJson(json) {
  return json.replace(
    /("priority"\s*:\s*)(?!-?\d+(?:\.\d+)?\s*[,}]|"[^"\\]*(?:\\.[^"\\]*)*"\s*[,}])([\s\S]*?)(?=,\s*"(?:content|type|priority|source_message_ids|metadata)"\s*:|[}\]])/g,
    (_m, prefix) => `${prefix}50`
  ).replace(/,\s*([}\]])/g, "$1");
}
var VALID_TYPES = [
  "persona",
  "episodic",
  "instruction",
  "work_fact",
  "work_task",
  "work_method",
  "work_artifact"
];
function normalizeType(raw) {
  const lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower)) {
    return lower;
  }
  if (lower === "episode")
    return "episodic";
  if (lower === "instruct")
    return "instruction";
  if (lower === "preference")
    return "persona";
  return null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extractL1Memories,
  parseExtractionResult
});
