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

// src/scene/scene-file.ts
var scene_file_exports = {};
__export(scene_file_exports, {
  parseSceneFile: () => parseSceneFile,
  sanitizeSceneName: () => sanitizeSceneName,
  serializeSceneFile: () => serializeSceneFile,
  syncSceneIndex: () => syncSceneIndex
});
module.exports = __toCommonJS(scene_file_exports);
var import_fs = require("fs");
var import_path = require("path");
var META_RE = /-----META-START-----\n([\s\S]*?)\n-----META-END-----\n?\n?/;
function parseSceneFile(raw) {
  const match = META_RE.exec(raw);
  if (!match)
    return null;
  const metaBlock = match[1];
  const meta = {};
  for (const line of metaBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1)
      continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "created")
      meta.created = value;
    else if (key === "updated")
      meta.updated = value;
    else if (key === "summary")
      meta.summary = value;
    else if (key === "heat") {
      const n = Number(value);
      meta.heat = Number.isFinite(n) ? n : 0;
    }
  }
  if (meta.created === void 0 || meta.updated === void 0 || meta.summary === void 0 || meta.heat === void 0) {
    return null;
  }
  const body = raw.slice(match[0].length).replace(/^\n+/, "");
  return { path: "", meta, body };
}
function serializeSceneFile(scene) {
  const { meta } = scene;
  const metaBlock = [
    "-----META-START-----",
    `created: ${meta.created}`,
    `updated: ${meta.updated}`,
    `summary: ${meta.summary}`,
    `heat: ${meta.heat}`,
    "-----META-END-----"
  ].join("\n");
  return `${metaBlock}

${scene.body}`;
}
function sanitizeSceneName(name) {
  const cleaned = name.replace(/[^a-zA-Z0-9一-鿿_.-]/g, "");
  return cleaned === "" ? "scene" : cleaned;
}
function syncSceneIndex(scenesDir) {
  const sceneBlocksDir = (0, import_path.join)(scenesDir, "scene_blocks");
  const scanDir = (0, import_fs.existsSync)(sceneBlocksDir) ? sceneBlocksDir : scenesDir;
  let files;
  try {
    files = (0, import_fs.readdirSync)(scanDir).filter((f) => f.endsWith(".md"));
  } catch {
    files = [];
  }
  const entries = [];
  for (const f of files) {
    const raw = (0, import_fs.readFileSync)((0, import_path.join)(scanDir, f), "utf8");
    const scene = parseSceneFile(raw);
    if (!scene)
      continue;
    entries.push({ path: f, summary: scene.meta.summary, heat: scene.meta.heat, updated: scene.meta.updated });
  }
  entries.sort((a, b) => b.heat - a.heat);
  (0, import_fs.writeFileSync)((0, import_path.join)(scenesDir, "scene_index.json"), JSON.stringify(entries, null, 2), "utf8");
  return entries;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseSceneFile,
  sanitizeSceneName,
  serializeSceneFile,
  syncSceneIndex
});
