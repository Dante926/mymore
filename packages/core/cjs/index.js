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
  CONFLICT_DETECTION_SYSTEM_PROMPT: () => import_l1_dedup2.CONFLICT_DETECTION_SYSTEM_PROMPT,
  CascadeSync: () => import_cascade.CascadeSync,
  Consolidator: () => import_consolidator.Consolidator,
  DualWriter: () => import_dual_writer.DualWriter,
  EXTRACT_MEMORIES_SYSTEM_PROMPT: () => import_l1_extraction.EXTRACT_MEMORIES_SYSTEM_PROMPT,
  EmbeddingClient: () => import_vector.EmbeddingClient,
  LLMRunner: () => import_llm.LLMRunner,
  MIGRATION_SQL: () => import_models.MIGRATION_SQL,
  MarkdownHandler: () => import_markdown.MarkdownHandler,
  MemoryStorage: () => import_storage.MemoryStorage,
  SCHEMA_SQL: () => import_models.SCHEMA_SQL,
  VectorStore: () => import_vector.VectorStore,
  appendL1Record: () => import_l1_writer.appendL1Record,
  applyDecisions: () => import_l1_dedup.applyDecisions,
  batchDedup: () => import_l1_dedup.batchDedup,
  classifyMemory: () => import_classifier.classifyMemory,
  computeSha256: () => import_storage.computeSha256,
  extractL1Memories: () => import_l1_extractor.extractL1Memories,
  formatExtractionPrompt: () => import_l1_extraction.formatExtractionPrompt,
  generateMemoryId: () => import_l1_writer.generateMemoryId,
  getL1Record: () => import_l1_writer.getL1Record,
  groupFilePath: () => import_markdown.groupFilePath,
  loadConfig: () => import_config.loadConfig,
  mdPathForEntry: () => import_markdown.mdPathForEntry,
  readConversationMessages: () => import_l0_recorder.readConversationMessages,
  readL1Records: () => import_l1_writer.readL1Records,
  recordConversation: () => import_l0_recorder.recordConversation,
  saveConfig: () => import_config.saveConfig
});
module.exports = __toCommonJS(src_exports);
var import_models = require("./models.js");
var import_classifier = require("./classifier.js");
var import_storage = require("./storage.js");
var import_markdown = require("./markdown.js");
var import_cascade = require("./cascade.js");
var import_consolidator = require("./consolidator.js");
var import_l0_recorder = require("./conversation/l0-recorder.js");
var import_config = require("./config.js");
var import_vector = require("./vector.js");
var import_l1_writer = require("./record/l1-writer.js");
var import_dual_writer = require("./record/dual-writer.js");
var import_llm = require("./llm.js");
var import_l1_extractor = require("./record/l1-extractor.js");
var import_l1_extraction = require("./prompts/l1-extraction.js");
var import_l1_dedup = require("./record/l1-dedup.js");
var import_l1_dedup2 = require("./prompts/l1-dedup.js");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFLICT_DETECTION_SYSTEM_PROMPT,
  CascadeSync,
  Consolidator,
  DualWriter,
  EXTRACT_MEMORIES_SYSTEM_PROMPT,
  EmbeddingClient,
  LLMRunner,
  MIGRATION_SQL,
  MarkdownHandler,
  MemoryStorage,
  SCHEMA_SQL,
  VectorStore,
  appendL1Record,
  applyDecisions,
  batchDedup,
  classifyMemory,
  computeSha256,
  extractL1Memories,
  formatExtractionPrompt,
  generateMemoryId,
  getL1Record,
  groupFilePath,
  loadConfig,
  mdPathForEntry,
  readConversationMessages,
  readL1Records,
  recordConversation,
  saveConfig
});
