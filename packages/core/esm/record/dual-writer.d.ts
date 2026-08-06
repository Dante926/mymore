import type { MemoryStorage } from '../storage.js';
import type { VectorStore, EmbeddingClient } from '../vector.js';
import type { L1Record } from './l1-writer.js';
export declare class DualWriter {
    private opts;
    constructor(opts: {
        storage: MemoryStorage;
        vector: VectorStore;
        embed: EmbeddingClient;
        baseDir: string;
        team?: string;
        agent?: string;
    });
    storeL1(record: L1Record): Promise<{
        id: string;
    }>;
    deprecateL1(id: string): Promise<void>;
}
//# sourceMappingURL=dual-writer.d.ts.map