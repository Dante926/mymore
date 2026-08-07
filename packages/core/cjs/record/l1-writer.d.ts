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
/** 生成唯一记忆 id：rec_{ts}_{3 字节 hex} */
export declare function generateMemoryId(): string;
/**
 * 把一条结构化记忆记录 append 到 {baseDir}/records/YYYY-MM-DD.jsonl
 * （所有 team 共用同一份文件，读取时按 team/agent 行级过滤），返回 record.id。
 */
export declare function appendL1Record(record: L1Record, baseDir: string, _team?: string, _agent?: string): string;
/** 读取所有日文件（排序）→ 按 team/agent 行级过滤 → version > afterVersion → 截取最新 limit 条 */
export declare function readL1Records(baseDir: string, opts?: ReadL1RecordsOptions): L1Record[];
/** 线性扫描取单条记录（记录量小，暂不优化） */
export declare function getL1Record(id: string, baseDir: string): L1Record | null;
//# sourceMappingURL=l1-writer.d.ts.map