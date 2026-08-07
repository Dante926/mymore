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

// src/scene/scene-extractor.ts
var scene_extractor_exports = {};
__export(scene_extractor_exports, {
  SceneExtractor: () => SceneExtractor,
  parseSceneDecision: () => parseSceneDecision
});
module.exports = __toCommonJS(scene_extractor_exports);
var import_fs = require("fs");
var import_path = require("path");
var import_scene_file = require("./scene-file.js");
var import_scene_extraction = require("../prompts/scene-extraction.js");
var DEFAULT_MAX_SCENES = 50;
var SceneExtractor = class {
  constructor(opts) {
    this.llm = opts.llm;
    this.scenesDir = opts.scenesDir;
    this.team = opts.team;
    this.agent = opts.agent;
    this.maxScenes = opts.maxScenes ?? DEFAULT_MAX_SCENES;
  }
  /**
   * 运行 L2 提取管线：组 prompt → LLM 单次调用 → 解析 JSON → 应用动作 → 重建索引。
   */
  async extractL2(params) {
    const { newRecords, existingScenes, lastSceneIndex } = params;
    const prompt = this.buildPrompt(newRecords, existingScenes, lastSceneIndex);
    const systemPrompt = (0, import_scene_extraction.buildSceneSystemPrompt)(this.maxScenes);
    const raw = await this.llm.run({
      prompt,
      systemPrompt,
      taskId: "l2-scene-extraction",
      timeoutMs: 18e4
    });
    const decision = parseSceneDecision(raw);
    return this.applyDecision(decision, existingScenes);
  }
  // ============================
  // Prompt assembly
  // ============================
  buildPrompt(newRecords, existingScenes, lastSceneIndex) {
    const memoriesText = newRecords.length > 0 ? newRecords.map((r) => {
      const parts = [
        `[id] ${r.id}`,
        `[type] ${r.type}`,
        `[priority] ${r.priority}`,
        `[created_at] ${r.created_at}`,
        `[content] ${r.content}`
      ];
      if (r.scene_name)
        parts.push(`[scene_name] ${r.scene_name}`);
      return parts.join("\n");
    }).join("\n\n") : "（本批无新增记忆，仅做既有场景的整理/合并）";
    const scenesText = existingScenes.length > 0 ? existingScenes.map(
      (s) => `- path: ${s.path}
  summary: ${s.meta.summary}
  heat: ${s.meta.heat}
  updated: ${s.meta.updated}
  body:
${this.indent(s.body, 4)}`
    ).join("\n\n") : "（当前无已有场景文件）";
    const indexText = lastSceneIndex.length > 0 ? lastSceneIndex.map((e) => `- path: ${e.path} | summary: ${e.summary} | heat: ${e.heat} | updated: ${e.updated}`).join("\n") : "（暂无索引快照）";
    return `**输出语言**：\`content\`/\`scene_name\`/\`summary\` 使用下方 New Memories List 中记忆的主导语言；JSON 字段名保持英文。

### 1️⃣ New Memories List
${memoriesText}

### 2️⃣ Existing Scene Blocks Summary（${existingScenes.length} 个场景）
${scenesText}

### 3️⃣ Existing Scene Index（scene_index.json 快照）
${indexText}

请按系统提示词中的策略（UPDATE 首选 > MERGE > CREATE 最后手段）输出 JSON 决策。`;
  }
  indent(text, spaces) {
    const pad = " ".repeat(spaces);
    return text.split("\n").map((line) => line.length > 0 ? pad + line : line).join("\n");
  }
  // ============================
  // Apply decision
  // ============================
  async applyDecision(decision, existingScenes) {
    const action = normalizeAction(decision.action);
    const sceneMap = new Map(existingScenes.map((s) => [s.path, s]));
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const deletedPaths = [];
    let targetPath;
    let newSceneName;
    let content = "";
    let heat = 0;
    if (action === "update" || action === "merge") {
      const target = decision.target_path ?? (existingScenes.length > 0 ? existingScenes[0].path : void 0);
      if (!target) {
        throw new Error(`[scene-extractor] ${action} 需要 target_path，但 JSON 未提供且无既有场景可回退`);
      }
      targetPath = target;
      const old = sceneMap.get(target);
      const oldHeat = old ? old.meta.heat : 0;
      const llmHeat = typeof decision.heat === "number" && Number.isFinite(decision.heat) && decision.heat > 0 ? Math.floor(decision.heat) : 0;
      if (action === "merge") {
        const deleted = Array.isArray(decision.deleted_paths) ? decision.deleted_paths.map(String) : [];
        for (const p of deleted) {
          const oldFile = sceneMap.get(p);
          if (oldFile)
            heat += oldFile.meta.heat;
          this.softDelete(p);
          deletedPaths.push(p);
        }
        heat += oldHeat + 1;
        if (llmHeat > 0)
          heat = llmHeat;
        const created = (old == null ? void 0 : old.meta.created) ?? now.slice(0, 10);
        content = normalizeContent(decision.content, created, now, decision.summary ?? "", heat);
      } else {
        heat = llmHeat > 0 ? llmHeat : oldHeat + 1;
        const created = (old == null ? void 0 : old.meta.created) ?? now.slice(0, 10);
        content = normalizeContent(decision.content, created, now, decision.summary ?? "", heat);
      }
      const targetResolved = this.resolveScenePath(targetPath);
      this.writeSceneResolved(targetResolved, content);
    } else {
      const rawName = decision.scene_name && decision.scene_name.trim().length > 0 ? decision.scene_name : `scene-${Date.now()}`;
      let fileName = (0, import_scene_file.sanitizeSceneName)(rawName);
      if (!fileName.endsWith(".md"))
        fileName = `${fileName}.md`;
      newSceneName = rawName;
      targetPath = fileName;
      heat = 1;
      content = normalizeContent(
        decision.content,
        now.slice(0, 10),
        now,
        decision.summary ?? "",
        heat
      );
      this.writeScene(fileName, content);
    }
    (0, import_scene_file.syncSceneIndex)(this.scenesDir);
    return {
      action,
      targetPath,
      content,
      newSceneName,
      deletedPaths: deletedPaths.length > 0 ? deletedPaths : void 0,
      personaUpdateRequested: decision.request_persona_update === true,
      summary: decision.summary ?? "",
      heat
    };
  }
  /** 按原始文件名写入场景（create 用，fileName 已 sanitizeSceneName 归一，仍走 resolve 消毒）。 */
  writeScene(fileName, content) {
    this.writeSceneResolved(this.resolveScenePath(fileName), content);
  }
  /** 按已 resolve 的绝对路径写入（update/merge 用，路径已通过 resolveScenePath 断言在 scenesDir 内）。 */
  writeSceneResolved(fullPath, content) {
    (0, import_fs.mkdirSync)(this.scanDir(), { recursive: true });
    (0, import_fs.writeFileSync)(fullPath, content, "utf8");
  }
  /** 软删除：把文件内容覆写为 [DELETED] 标记（对齐蓝图 §4.2 / 参考实现：空字符串会被拒绝）。 */
  softDelete(fileName) {
    const full = this.resolveScenePath(fileName);
    if ((0, import_fs.existsSync)(full)) {
      (0, import_fs.writeFileSync)(full, "[DELETED]", "utf8");
    }
  }
  /** 场景文件的扫描目录：`scene_blocks/` 存在则用之，否则退回 scenesDir（与 syncSceneIndex 一致）。 */
  scanDir() {
    const sceneBlocksDir = (0, import_path.join)(this.scenesDir, "scene_blocks");
    return (0, import_fs.existsSync)(sceneBlocksDir) ? sceneBlocksDir : this.scenesDir;
  }
  /**
   * 路径消毒（防逃逸）：把 LLM 提供的文件名 resolve 后断言其位于 scenesDir 内。
   * `../x.md`、绝对路径、嵌套目录越界等一律拒绝并抛错，绝不写出 scenesDir。
   */
  resolveScenePath(fileName) {
    const full = (0, import_path.join)(this.scanDir(), fileName);
    const root = `${(0, import_path.resolve)(this.scenesDir)}${import_path.sep}`;
    if (!(0, import_path.resolve)(full).startsWith(root)) {
      throw new Error(`[scene-extractor] 非法路径（逃逸 scenesDir）: ${fileName}`);
    }
    return full;
  }
};
function normalizeAction(raw) {
  const a = String(raw ?? "").trim().toLowerCase();
  if (a === "merge")
    return "merge";
  if (a === "create")
    return "create";
  return "update";
}
function normalizeContent(rawContent, created, updated, summary, heat) {
  let body = typeof rawContent === "string" ? rawContent : "";
  if (body.trim() === "")
    body = "[空白场景]";
  const metaRe = /-----META-START-----\n[\s\S]*?\n-----META-END-----\n?\n?/;
  body = body.replace(metaRe, "").replace(/^\n+/, "");
  const scene = {
    path: "",
    meta: { created, updated, summary, heat },
    body
  };
  return (0, import_scene_file.serializeSceneFile)(scene);
}
function parseSceneDecision(raw) {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    const objectJson = extractFirstJsonObject(cleaned);
    if (objectJson === null) {
      throw new Error("L2 LLM 输出中未找到合法 JSON 对象");
    }
    const sanitized = sanitizeJsonForParse(objectJson);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const repaired = repairSceneJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("L2 LLM 输出 JSON 不是对象");
    }
    const d = parsed;
    return {
      action: typeof d.action === "string" ? d.action : "update",
      target_path: typeof d.target_path === "string" ? d.target_path : void 0,
      content: typeof d.content === "string" ? d.content : "",
      scene_name: typeof d.scene_name === "string" ? d.scene_name : void 0,
      deleted_paths: Array.isArray(d.deleted_paths) ? d.deleted_paths.map(String) : [],
      request_persona_update: d.request_persona_update === true,
      summary: typeof d.summary === "string" ? d.summary : "",
      heat: typeof d.heat === "number" && Number.isFinite(d.heat) ? d.heat : void 0
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error(`L2 场景决策解析失败: ${String(err)}`);
  }
}
function extractFirstJsonObject(raw) {
  const start = raw.indexOf("{");
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
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0)
        return raw.slice(start, i + 1);
    }
  }
  return null;
}
function sanitizeJsonForParse(raw) {
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
function repairSceneJson(json) {
  return json.replace(/,\s*([}\]])/g, "$1");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SceneExtractor,
  parseSceneDecision
});
