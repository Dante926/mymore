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

// src/conversation/l0-recorder.ts
var l0_recorder_exports = {};
__export(l0_recorder_exports, {
  extractUserAssistantMessages: () => extractUserAssistantMessages,
  readConversationMessages: () => readConversationMessages,
  recordConversation: () => recordConversation
});
module.exports = __toCommonJS(l0_recorder_exports);
var import_fs = require("fs");
var import_path = require("path");
var import_crypto = require("crypto");
function dateStr(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 10);
}
function extractText(content) {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.filter((part) => {
      return typeof part === "object" && part !== null && part.type === "text" && typeof part.text === "string";
    }).map((part) => part.text ?? "").join("");
  }
  return "";
}
function stripBase64DataUris(text) {
  return text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[image]");
}
function extractUserAssistantMessages(messages, opts) {
  const out = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant")
      continue;
    const text = stripBase64DataUris(extractText(m.content)).trim();
    if (!text)
      continue;
    out.push({
      id: `msg_${Date.now()}_${(0, import_crypto.randomBytes)(3).toString("hex")}`,
      role: m.role,
      content: text,
      timestamp: m.timestamp ?? Date.now()
    });
  }
  return out;
}
async function recordConversation(params) {
  const {
    sessionKey,
    sessionId = sessionKey,
    userId,
    agentId,
    messages,
    baseDir,
    originalUserText,
    afterTimestamp
  } = params;
  const recordedAt = (/* @__PURE__ */ new Date()).toISOString();
  const extracted = extractUserAssistantMessages(messages, {
    sessionKey,
    sessionId,
    userId,
    agentId,
    recordedAt
  });
  if (originalUserText !== void 0) {
    const target = extracted.find((m) => m.role === "user");
    if (target)
      target.content = originalUserText;
  }
  const filtered = afterTimestamp === void 0 ? extracted : extracted.filter((m) => m.timestamp > afterTimestamp);
  if (filtered.length === 0)
    return [];
  const records = filtered.map((m) => ({
    sessionKey,
    sessionId,
    userId,
    agentId,
    recordedAt,
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp
  }));
  const dayDir = (0, import_path.join)(baseDir, "conversations");
  (0, import_fs.mkdirSync)(dayDir, { recursive: true });
  const file = (0, import_path.join)(dayDir, `${dateStr()}.jsonl`);
  for (const rec of records) {
    (0, import_fs.appendFileSync)(file, `${JSON.stringify(rec)}
`, "utf-8");
  }
  return records;
}
async function readConversationMessages(sessionKey, baseDir, afterTimestamp, limit) {
  const dayDir = (0, import_path.join)(baseDir, "conversations");
  let files;
  try {
    files = (0, import_fs.readdirSync)(dayDir);
  } catch {
    return [];
  }
  const lines = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".jsonl"))
      continue;
    const raw = (0, import_fs.readFileSync)((0, import_path.join)(dayDir, file), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      let rec;
      try {
        rec = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (rec.sessionKey !== sessionKey)
        continue;
      if (afterTimestamp !== void 0 && !(rec.timestamp > afterTimestamp))
        continue;
      lines.push({ role: rec.role, content: rec.content, timestamp: rec.timestamp });
    }
  }
  lines.sort((a, b) => a.timestamp - b.timestamp);
  const sliced = limit !== void 0 && lines.length > limit ? lines.slice(lines.length - limit) : lines;
  return sliced;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extractUserAssistantMessages,
  readConversationMessages,
  recordConversation
});
