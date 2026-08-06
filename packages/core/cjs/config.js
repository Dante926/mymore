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

// src/config.ts
var config_exports = {};
__export(config_exports, {
  loadConfig: () => loadConfig,
  saveConfig: () => saveConfig
});
module.exports = __toCommonJS(config_exports);
var import_fs = require("fs");
var import_path = require("path");
var import_os = require("os");
var import_zod = require("zod");
var pipelineSchema = import_zod.z.object({
  everyNConversations: import_zod.z.number().default(5),
  l1IdleTimeoutSeconds: import_zod.z.number().default(600),
  l2DelayAfterL1Seconds: import_zod.z.number().default(90),
  l2MinIntervalSeconds: import_zod.z.number().default(900),
  l2MaxIntervalSeconds: import_zod.z.number().default(3600),
  triggerEveryN: import_zod.z.number().default(10)
});
var llmSchema = import_zod.z.object({
  baseUrl: import_zod.z.string().default(""),
  apiKey: import_zod.z.string().default(""),
  model: import_zod.z.string().default(""),
  embeddingModel: import_zod.z.string().optional()
});
var configSchema = import_zod.z.object({
  llm: import_zod.z.preprocess((v) => v ?? {}, llmSchema),
  pipeline: import_zod.z.preprocess((v) => v ?? {}, pipelineSchema)
});
function resolveRoot(rootDir) {
  return rootDir ?? (0, import_path.join)((0, import_os.homedir)(), ".mymore");
}
function loadConfig(rootDir) {
  const root = resolveRoot(rootDir);
  const file = (0, import_path.join)(root, "config.json");
  const raw = (0, import_fs.existsSync)(file) ? JSON.parse((0, import_fs.readFileSync)(file, "utf-8")) : {};
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid mymore config at ${file}: ${parsed.error.message}`
    );
  }
  return parsed.data;
}
function saveConfig(config, rootDir) {
  const root = resolveRoot(rootDir);
  (0, import_fs.mkdirSync)(root, { recursive: true });
  (0, import_fs.writeFileSync)((0, import_path.join)(root, "config.json"), JSON.stringify(config, null, 2));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  loadConfig,
  saveConfig
});
