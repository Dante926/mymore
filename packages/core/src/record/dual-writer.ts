import type { MemoryStorage } from '../storage.js';
import type { VectorStore, EmbeddingClient } from '../vector.js';
import { appendL1Record } from './l1-writer.js';
import type { L1Record } from './l1-writer.js';

export class DualWriter {
  constructor(private opts: { storage: MemoryStorage; vector: VectorStore; embed: EmbeddingClient; baseDir: string; team?: string; agent?: string }) {}

  async storeL1(record: L1Record): Promise<{ id: string }> {
    const { storage, vector, embed, baseDir, team, agent } = this.opts;
    appendL1Record({ ...record, team: record.team ?? team, agent: record.agent ?? agent }, baseDir);
    if (record.version > 1) vector.remove(record.id);
    const vec = await embed.embed(record.content);
    vector.upsert(record.id, vec);
    // memory_meta.id 是主键：新 id 走 add 插入，已存在（version 升级）走 updateRow 覆盖索引列
    const existing = storage.getById(record.id);
    if (existing) {
      storage.updateRow(record.id, {
        type: record.type, priority: record.priority, scene_name: record.scene_name,
        version: record.version, source_message_ids: JSON.stringify(record.source_message_ids),
        team, agent, category: 'persistent', frozen: record.priority >= 90 ? 1 : 0,
      } as any);
    } else {
      storage.add({
        id: record.id, track: 'user', owner_id: agent ?? 'default', category: 'persistent',
        content: record.content, created_at: record.created_at, frozen: record.priority >= 90,
        access_count: 0, type: record.type, priority: record.priority,
        scene_name: record.scene_name, version: record.version,
        source_message_ids: JSON.stringify(record.source_message_ids), team, agent,
      });
    }
    return { id: record.id };
  }

  async deprecateL1(id: string): Promise<void> {
    this.opts.storage.updateRow(id, { category: 'archived', frozen: 0 } as any);
    this.opts.vector.remove(id);
  }
}
