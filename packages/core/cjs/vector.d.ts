export interface EmbeddingClientConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    /** 专用的 embedding 模型名；缺省回退到 model（chat 模型）。 */
    embeddingModel?: string;
}
export declare class EmbeddingClient {
    private cfg;
    constructor(cfg: EmbeddingClientConfig);
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