// @mymore/core — 分类优先的轻量 MCP 记忆存储系统

export { SCHEMA_SQL, MIGRATION_SQL } from "./models.js";
export { classifyMemory } from "./classifier.js";
export { MemoryStorage, computeSha256 } from "./storage.js";
export { MarkdownHandler, mdPathForEntry, groupFilePath } from "./markdown.js";
export { CascadeSync } from "./cascade.js";
export { Consolidator } from "./consolidator.js";
export { recordConversation, readConversationMessages } from "./conversation/l0-recorder.js";
export { loadConfig, saveConfig } from "./config.js";
export { EmbeddingClient, VectorStore } from "./vector.js";
export { appendL1Record, readL1Records, getL1Record, generateMemoryId } from "./record/l1-writer.js";
export { DualWriter } from "./record/dual-writer.js";
export { LLMRunner } from "./llm.js";
export { extractL1Memories } from "./record/l1-extractor.js";
export { EXTRACT_MEMORIES_SYSTEM_PROMPT, formatExtractionPrompt } from "./prompts/l1-extraction.js";

// L2/L3 — Scene/Persona 新模块
export { parseSceneFile, serializeSceneFile, sanitizeSceneName, syncSceneIndex } from "./scene/scene-file.js";
export { SceneExtractor } from "./scene/scene-extractor.js";
export { buildSceneSystemPrompt } from "./prompts/scene-extraction.js";
export { PersonaGenerator } from "./persona/persona-generator.js";
export { buildPersonaSystemPrompt } from "./prompts/persona-generation.js";
export { batchDedup, applyDecisions } from "./record/l1-dedup.js";
export { CONFLICT_DETECTION_SYSTEM_PROMPT } from "./prompts/l1-dedup.js";