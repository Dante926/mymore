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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CascadeSync: () => import_cascade.CascadeSync,
  Consolidator: () => import_consolidator.Consolidator,
  MIGRATION_SQL: () => import_models.MIGRATION_SQL,
  MarkdownHandler: () => import_markdown.MarkdownHandler,
  MemoryStorage: () => import_storage.MemoryStorage,
  SCHEMA_SQL: () => import_models.SCHEMA_SQL,
  classifyMemory: () => import_classifier.classifyMemory,
  computeSha256: () => import_storage.computeSha256,
  groupFilePath: () => import_markdown.groupFilePath,
  mdPathForEntry: () => import_markdown.mdPathForEntry
});
module.exports = __toCommonJS(src_exports);
var import_models = require("./models.js");
var import_classifier = require("./classifier.js");
var import_storage = require("./storage.js");
var import_markdown = require("./markdown.js");
var import_cascade = require("./cascade.js");
var import_consolidator = require("./consolidator.js");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CascadeSync,
  Consolidator,
  MIGRATION_SQL,
  MarkdownHandler,
  MemoryStorage,
  SCHEMA_SQL,
  classifyMemory,
  computeSha256,
  groupFilePath,
  mdPathForEntry
});
