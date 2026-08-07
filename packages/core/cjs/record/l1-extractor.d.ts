/**
 * L1 Memory Extractor：单次 LLM 调用做「情境切分 + 记忆提取 + JSON 输出」，
 * 带严格的解析容错（LLM 输出永远不可信）。
 *
 * 管线：
 * 1. 把 messages 切分为 newMessages（后 maxMessagesPerExtraction=10 条）+ backgroundMessages（紧邻前最多 5 条，仅作上下文）
 * 2. 单次 LLM 调用提取情境切分后的记忆（taskId='l1-extraction', timeoutMs=180_000）
 * 3. parseExtractionResult：剥代码块 → 抽第一个 [...] → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 → 逐字段补默认 → normalizeType
 * 4. 截断（maxMemoriesPerSession=10）→ 构建 L1Record → appendL1Record 落盘（真源）→ 返回结果
 *
 * 失败处理：LLM 抛错 → success:false 全 0；单条写失败 warn 跳过不中断批次。
 */
import type { ConversationMessage } from '../conversation/l0-recorder.js';
import type { LLMRunner } from '../llm.js';
import type { L1Record } from './l1-writer.js';
export interface SceneSegment {
    scene_name: string;
    message_ids: string[];
    memories: Array<{
        content: string;
        type: string;
        priority: number;
        source_message_ids: string[];
        metadata: Record<string, unknown>;
    }>;
}
export interface L1ExtractionResult {
    /** 是否成功 */
    success: boolean;
    /** 提取到的记忆条数 */
    extractedCount: number;
    /** 实际落盘条数 */
    storedCount: number;
    /** 落盘的记忆记录 */
    records: L1Record[];
    /** 本次检测到的情境名列表 */
    sceneNames: string[];
    /** 最后一个情境名（供下次提取续用） */
    lastSceneName?: string;
}
export interface ExtractL1Params {
    messages: ConversationMessage[];
    llm: LLMRunner;
    baseDir: string;
    sessionKey: string;
    maxMessagesPerExtraction?: number;
    maxBackgroundMessages?: number;
    maxMemoriesPerSession?: number;
    previousSceneName?: string;
}
/**
 * 运行完整 L1 提取管线。
 */
export declare function extractL1Memories(params: ExtractL1Params): Promise<L1ExtractionResult>;
/**
 * 把 LLM 输出的 JSON 响应解析为 SceneSegment[]。
 * 容错链：剥代码块 → 正则抽第一个 [...] → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 →
 * 逐字段补默认（scene_name→"未知情境"，type→"episodic"，priority→50，source_message_ids→[]，metadata→{}）。
 */
export declare function parseExtractionResult(raw: string): SceneSegment[];
//# sourceMappingURL=l1-extractor.d.ts.map