import Database from 'better-sqlite3';
import { getLoadablePath } from 'sqlite-vec';

export interface EmbeddingClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 专用的 embedding 模型名；缺省回退到 model（chat 模型）。 */
  embeddingModel?: string;
}

export class EmbeddingClient {
  constructor(private cfg: EmbeddingClientConfig) {}

  async embed(text: string): Promise<Float32Array> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const res = await fetch(`${this.cfg.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({ model: this.cfg.embeddingModel ?? this.cfg.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Embedding request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return body.data.map((d) => new Float32Array(d.embedding));
  }
}

export interface VectorSearchHit {
  record_id: string;
  score: number;
}

export class VectorStore {
  private db: Database.Database;

  constructor(private dbPath: string, private dims: number) {
    this.db = new Database(dbPath);
    this.db.loadExtension(getLoadablePath());
    this.ensureSchema();
  }

  ensureSchema(): void {
    this.db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(record_id TEXT PRIMARY KEY, embedding FLOAT[${this.dims}])`,
    );
  }

  upsert(recordId: string, vec: Float32Array): void {
    this.db
      .prepare('INSERT OR REPLACE INTO vec_items(record_id, embedding) VALUES (?, ?)')
      .run(recordId, vec);
  }

  remove(recordId: string): void {
    this.db.prepare('DELETE FROM vec_items WHERE record_id = ?').run(recordId);
  }

  search(vec: Float32Array, topK: number): VectorSearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT record_id, vec_distance_cosine(embedding, $vec) AS distance
         FROM vec_items WHERE embedding MATCH $vec AND k = $k`,
      )
      .all({ vec, k: topK }) as Array<{ record_id: string; distance: number | null }>;
    // 过滤零相似度结果（cosine distance=1）：正交向量不算命中
    return rows
      .filter((r) => (r.distance ?? 1) < 1)
      .map((r) => ({
        record_id: r.record_id,
        score: 1 - (r.distance ?? 1),
      }));
  }

  close(): void {
    this.db.close();
  }
}
