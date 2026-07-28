// @mymore/core — 分类优先的轻量 MCP 记忆存储系统

export type {
  MemoryEntry, MemoryRow, SearchResult,
  AddMemoryInput, SearchFilters, ConsolidateInput,
  FrozenSnapshotInput, Track, Category,
} from './models.js';
export { SCHEMA_SQL, MIGRATION_SQL } from './models.js';

export { classifyMemory } from './classifier.js';

export { MemoryStorage, computeSha256 } from './storage.js';

export { MarkdownHandler, mdPathForEntry, groupFilePath } from './markdown.js';

export { CascadeSync } from './cascade.js';

export { Consolidator } from './consolidator.js';
export type { DedupResult, ConsolidationSummary } from './consolidator.js';
