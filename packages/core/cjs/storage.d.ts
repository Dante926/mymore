import type { MemoryEntry, MemoryRow, SearchResult, SearchFilters } from './models.js';
export declare function computeSha256(content: string, category: string, frozen: boolean): string;
export declare class MemoryStorage {
    private db;
    constructor(dbPath: string);
    private runMigration;
    add(entry: MemoryEntry): MemoryRow;
    appendToGroup(groupKey: string, content: string, entry: MemoryEntry): MemoryRow;
    search(query?: string, filters?: SearchFilters): SearchResult[];
    getById(id: string): MemoryRow | null;
    getBySha256(sha: string): MemoryRow | null;
    getByMdPath(mdPath: string): MemoryRow | null;
    getByGroupKey(groupKey: string, ownerId: string, category?: string): MemoryRow | null;
    getContentById(id: string): string | null;
    updateMdPath(id: string, mdPath: string): void;
    updateRow(id: string, changes: Partial<MemoryRow>): void;
    markSuperseded(id: string, supersededBy: string): void;
    incrementAccess(id: string): void;
    getFrozenSnapshot(ownerId: string, maxTokens?: number): string;
    listExpired(): MemoryRow[];
    purgeArchived(retentionDays?: number): {
        id: string;
        md_path: string;
    }[];
    purgeSuperseded(days?: number): {
        id: string;
        md_path: string;
    }[];
    listByOwner(ownerId: string, days?: number, category?: string): (MemoryRow & {
        content: string;
    })[];
    listByGroupKey(ownerId: string): Record<string, (MemoryRow & {
        content: string;
    })[]>;
    close(): void;
    private rowToMemoryRow;
}
//# sourceMappingURL=storage.d.ts.map