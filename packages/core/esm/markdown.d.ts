import type { MemoryEntry } from './models.js';
export declare function mdPathForEntry(rootDir: string, entry: MemoryEntry): string;
export declare function groupFilePath(rootDir: string, groupKey: string): string;
export declare class MarkdownHandler {
    private rootDir;
    constructor(rootDir: string);
    writeEntry(entry: MemoryEntry): string;
    readEntry(mdPath: string): MemoryEntry | null;
    getEntryId(mdPath: string): string | null;
    deleteOrMark(mdPath: string): void;
    deleteFile(mdPath: string): void;
    /** Append a single entry to a group markdown file (create if not exists). */
    appendToGroup(entry: MemoryEntry): string;
    /** Read all entries from a group file, ordered by append order (oldest first). */
    readGroupEntries(groupKey: string): MemoryEntry[];
    /** Read group file header frontmatter. */
    readGroupHeader(groupKey: string): Record<string, unknown> | null;
    /** Scan all group files in memory/groups/. */
    scanGroups(): {
        path: string;
        sha256: string;
    }[];
    scanAll(): {
        path: string;
        sha256: string;
    }[];
}
//# sourceMappingURL=markdown.d.ts.map