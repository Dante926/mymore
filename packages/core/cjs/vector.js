var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vector.ts
var vector_exports = {};
__export(vector_exports, {
  EmbeddingClient: () => EmbeddingClient,
  VectorStore: () => VectorStore
});
module.exports = __toCommonJS(vector_exports);
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_sqlite_vec = require("sqlite-vec");
var EmbeddingClient = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  async embed(text) {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }
  async embedBatch(texts) {
    const res = await fetch(`${this.cfg.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`
      },
      body: JSON.stringify({ model: this.cfg.embeddingModel ?? this.cfg.model, input: texts })
    });
    if (!res.ok) {
      throw new Error(`Embedding request failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    return body.data.map((d) => new Float32Array(d.embedding));
  }
};
var VectorStore = class {
  constructor(dbPath, dims) {
    this.dbPath = dbPath;
    this.dims = dims;
    this.db = new import_better_sqlite3.default(dbPath);
    this.db.loadExtension((0, import_sqlite_vec.getLoadablePath)());
    this.ensureSchema();
  }
  ensureSchema() {
    this.db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(record_id TEXT PRIMARY KEY, embedding FLOAT[${this.dims}])`
    );
  }
  upsert(recordId, vec) {
    this.db.prepare("INSERT OR REPLACE INTO vec_items(record_id, embedding) VALUES (?, ?)").run(recordId, vec);
  }
  remove(recordId) {
    this.db.prepare("DELETE FROM vec_items WHERE record_id = ?").run(recordId);
  }
  search(vec, topK) {
    const rows = this.db.prepare(
      `SELECT record_id, vec_distance_cosine(embedding, $vec) AS distance
         FROM vec_items WHERE embedding MATCH $vec AND k = $k`
    ).all({ vec, k: topK });
    return rows.filter((r) => (r.distance ?? 1) < 1).map((r) => ({
      record_id: r.record_id,
      score: 1 - (r.distance ?? 1)
    }));
  }
  close() {
    this.db.close();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EmbeddingClient,
  VectorStore
});
