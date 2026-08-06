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
    /**
     * 刷新一条记忆的内容：更新 memory_fts 的 content + 按当前 category/frozen 重算 content_sha256。
     * 维护不变量 content_sha256 = computeSha256(content, category, frozen)（与 JSONL 真源一致）。
     * 注意：应在 updateRow（可能改 category/frozen）之后调用，否则 sha 会基于旧 category/frozen 计算。
     */
    updateContent(id: string, newContent: string): void;
    /**
     * 按当前 FTS content + category/frozen 重算 content_sha256（不改动 FTS content）。
     * 用于 deprecateL1/markSuperseded 这类 category/frozen 变更后维持不变量
     * content_sha256 = computeSha256(content, category, frozen)。
     */
    updateSha(id: string): void;
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