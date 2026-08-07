/** L1 提取输入消息类型：L0 写入记录的精简视图（含 id 用于 source_message_ids 追踪） */
export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
export interface L0MessageRecord {
    sessionKey: string;
    sessionId: string;
    userId?: string;
    agentId?: string;
    recordedAt: string;
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
export interface RecordConversationParams {
    sessionKey: string;
    sessionId?: string;
    userId?: string;
    agentId?: string;
    messages: Array<{
        role: string;
        content: string | Array<unknown>;
        timestamp?: number;
    }>;
    baseDir: string;
    originalUserText?: string;
    afterTimestamp?: number;
}
/** 提取 role=user/assistant 的消息，清洗 content 并补齐元数据 */
export declare function extractUserAssistantMessages(messages: Array<{
    role: string;
    content: string | Array<unknown>;
    timestamp?: number;
}>, opts: {
    sessionKey: string;
    sessionId: string;
    userId?: string;
    agentId?: string;
    recordedAt: string;
}): Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}>;
/**
 * 把每轮对话的 user/assistant 消息增量、清洗后写入 JSONL 文件
 * （{baseDir}/conversations/YYYY-MM-DD.jsonl），作为 L1 提取的输入真源。
 */
export declare function recordConversation(params: RecordConversationParams): Promise<L0MessageRecord[]>;
/** 读取所有日文件（排序）→ 按 sessionKey 行级过滤 → timestamp > afterTimestamp → 截取最新 limit 条 */
export declare function readConversationMessages(sessionKey: string, baseDir: string, afterTimestamp?: number, limit?: number): Promise<Array<{
    role: string;
    content: string;
    timestamp: number;
}>>;
//# sourceMappingURL=l0-recorder.d.ts.map