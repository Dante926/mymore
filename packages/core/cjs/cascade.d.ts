import type { MemoryEntry, MemoryRow } from './models.js';
import { type MemoryStorage } from './storage.js';
import type { MarkdownHandler } from './markdown.js';
export declare class CascadeSync {
    private storage;
    private md;
    constructor(storage: MemoryStorage, md: MarkdownHandler);
    syncOne(entry: MemoryEntry): {
        mdPath: string;
        changed: boolean;
    };
    scanAndSync(): {
        synced: number;
        skipped: number;
    };
    getByMdPath(mdPath: string): MemoryRow | null;
    private autoCleanup;
}
//# sourceMappingURL=cascade.d.ts.map