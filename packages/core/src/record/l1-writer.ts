import { mkdirSync, appendFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

export type L1RecordType = 'persona' | 'episodic' | 'instruction' | 'work_fact' | 'work_task' | 'work_method' | 'work_artifact';

export interface L1Record {
  id: string;
  type: L1RecordType;
  content: string;
  priority: number;
  scene_name?: string;
  source_message_ids: string[];
  created_at: string;
  version: number;
  team?: string;
  agent?: string;
  /** 记忆元数据（Plan 3 硬前提 1：L1 episodic 的 activity_* 时间等字段不再被丢弃）。 */
  metadata?: Record<string, unknown>;
}

export interface ReadL1RecordsOptions {
  afterVersion?: number;
  team?: string;
  agent?: string;
  limit?: number;
}

function dateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 生成唯一记忆 id：rec_{ts}_{3 字节 hex} */
export function generateMemoryId(): string {
  return `rec_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

/**
 * 把一条结构化记忆记录 append 到 {baseDir}/records/YYYY-MM-DD.jsonl
 * （所有 team 共用同一份文件，读取时按 team/agent 行级过滤），返回 record.id。
 */
export function appendL1Record(record: L1Record, baseDir: string, _team?: string, _agent?: string): string {
  const dayDir = join(baseDir, 'records');
  mkdirSync(dayDir, { recursive: true });
  const file = join(dayDir, `${dateStr()}.jsonl`);
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8');
  return record.id;
}

/** 读取所有日文件（排序）→ 按 team/agent 行级过滤 → version > afterVersion → 截取最新 limit 条 */
export function readL1Records(baseDir: string, opts: ReadL1RecordsOptions = {}): L1Record[] {
  const { afterVersion, team, agent, limit } = opts;
  const dayDir = join(baseDir, 'records');
  let files: string[];
  try {
    files = readdirSync(dayDir);
  } catch {
    return [];
  }

  const records: L1Record[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.jsonl')) continue;
    const raw = readFileSync(join(dayDir, file), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let rec: L1Record;
      try {
        rec = JSON.parse(trimmed) as L1Record;
      } catch {
        continue;
      }
      if (team !== undefined && rec.team !== team) continue;
      if (agent !== undefined && rec.agent !== agent) continue;
      if (afterVersion !== undefined && !(rec.version > afterVersion)) continue;
      records.push(rec);
    }
  }

  // 按 created_at 降序整体排序，再截取最新 limit 条
  records.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  if (limit !== undefined && records.length > limit) return records.slice(0, limit);
  return records;
}

/** 线性扫描取单条记录（记录量小，暂不优化） */
export function getL1Record(id: string, baseDir: string): L1Record | null {
  return readL1Records(baseDir).find((r) => r.id === id) ?? null;
}
