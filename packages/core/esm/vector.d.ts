export declare class EmbeddingClient {
    private cfg;
    constructor(cfg: {
        baseUrl: string;
        apiKey: string;
        model: string;
    });
    embed(text: string): Promise<Float32Array>;
    embedBatch(texts: string[]): Promise<Float32Array[]>;
}
export interface VectorSearchHit {
    record_id: string;
    score: number;
}
export declare class VectorStore {
    private dbPath;
    private dims;
    private db;
    constructor(dbPath: string, dims: number);
    ensureSchema(): void;
    upsert(recordId: string, vec: Float32Array): void;
    remove(recordId: string): void;
    search(vec: Float32Array, topK: number): VectorSearchHit[];
    close(): void;
}
//# sourceMappingURL=vector.d.ts.map