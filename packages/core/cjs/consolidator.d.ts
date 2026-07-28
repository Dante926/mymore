import type { MemoryStorage } from './storage.js';
import type { CascadeSync } from './cascade.js';
import type { MarkdownHandler } from './markdown.js';
export interface DedupResult {
    duplicates: [string, string][];
    conflicts: [string, string, string][];
    highlights: string[];
}
export interface ConsolidationSummary {
    archived: number;
    superseded: number;
    frozen: number;
    noise_cleaned: number;
    purged: number;
    highlights: string[];
}
export declare class Consolidator {
    private storage;
    private cascade;
    private md;
    private llmDedup?;
    constructor(storage: MemoryStorage, cascade: CascadeSync, md: MarkdownHandler, llmDedup?: ((entries: {
        id: string;
        content: string;
        created_at: string;
    }[]) => Promise<DedupResult>) | undefined);
    run(input: {
        owner_id?: string;
        days?: number;
        dry_run?: boolean;
        retention_days?: number;
    }): Promise<ConsolidationSummary>;
}
//# sourceMappingURL=consolidator.d.ts.map