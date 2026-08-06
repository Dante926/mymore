import type { MemoryStorage } from '../storage.js';
import type { VectorStore, EmbeddingClient } from '../vector.js';
import { appendL1Record } from './l1-writer.js';
import type { L1Record } from './l1-writer.js';

export class DualWriter {
  constructor(private opts: { storage: MemoryStorage; vector: VectorStore; embed: EmbeddingClient; baseDir: string; team?: string; agent?: string }) {}

  async storeL1(record: L1Record): Promise<{ id: string }> {
    const { storage, vector, embed, baseDir, team, agent } = this.opts;
    // JSONL 与 meta 统一使用 record 自带的 team/agent，缺省回退构造参数
    const teamName = record.team ?? team;
    const agentName = record.agent ?? agent;

    // 索引先行（embed + vector upsert + storage add/update），JSONL 真源最后写：
    // embed 失败时真源不领先索引，重试不会产生重复 JSONL 行。
    if (record.version > 1) vector.remove(record.id);
    const vec = await embed.embed(record.content);
    vector.upsert(record.id, vec);

    // memory_meta.id 是主键：新 id 走 add 插入，已存在（version 升级）走 updateRow 覆盖索引列
    const existing = storage.getById(record.id);
    if (existing) {
      // version-bump 只刷新存活的 persistent 记录；已被 deprecateL1/markSuperseded 归档的
      // 不复活——保留其 category（archived），仅更新内容相关列。
      const category = existing.category === 'persistent' ? 'persistent' : 'archived';
      storage.updateRow(record.id, {
        type: record.type, priority: record.priority, scene_name: record.scene_name,
        version: record.version, source_message_ids: JSON.stringify(record.source_message_ids),
        team: teamName, agent: agentName, category, frozen: record.priority >= 90 ? 1 : 0,
      } as any);
      // 刷新 FTS content + 重算 content_sha256（必须在 updateRow 之后，sha 依赖最终 category/frozen）
      storage.updateContent(record.id, record.content);
    } else {
      storage.add({
        id: record.id, track: 'user', owner_id: agentName ?? 'default', category: 'persistent',
        content: record.content, created_at: record.created_at, frozen: record.priority >= 90,
        access_count: 0, type: record.type, priority: record.priority,
        scene_name: record.scene_name, version: record.version,
        source_message_ids: JSON.stringify(record.source_message_ids), team: teamName, agent: agentName,
      });
    }

    // 真源最后写
    appendL1Record({ ...record, team: teamName, agent: agentName }, baseDir);
    return { id: record.id };
  }

  async deprecateL1(id: string): Promise<void> {
    const row = this.opts.storage.getById(id);
    if (row) {
      this.opts.storage.updateRow(id, { category: 'archived', frozen: 0 } as any);
      // category/frozen 变更后重算 content_sha256，维持 computeSha256(content, category, frozen)
      // 不变量，避免 getBySha256/CascadeSync.syncOne 把 archived 记录误判为 unchanged。
      this.opts.storage.updateSha(id);
    }
    this.opts.vector.remove(id);
  }
}
