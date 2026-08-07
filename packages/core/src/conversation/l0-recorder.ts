import { mkdirSync, appendFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/** L1 提取输入消息类型：L0 写入记录的精简视图（含 id 用于 source_message_ids 追踪） */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // epoch ms
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
  messages: Array<{ role: string; content: string | Array<unknown>; timestamp?: number }>;
  baseDir: string;
  originalUserText?: string;
  afterTimestamp?: number;
}

function dateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 从单条消息中提取纯文本 content：支持 string 或 {type:'text',text}[] 数组 */
function extractText(content: string | Array<unknown>): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: string; text?: string } => {
        return (
          typeof part === 'object' &&
          part !== null &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        );
      })
      .map((part) => part.text ?? '')
      .join('');
  }
  return '';
}

/** base64 图片 data URI → [image] */
function stripBase64DataUris(text: string): string {
  return text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[image]');
}

/** 提取 role=user/assistant 的消息，清洗 content 并补齐元数据 */
export function extractUserAssistantMessages(
  messages: Array<{ role: string; content: string | Array<unknown>; timestamp?: number }>,
  opts: { sessionKey: string; sessionId: string; userId?: string; agentId?: string; recordedAt: string },
): Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }> {
  const out: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }> = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const text = stripBase64DataUris(extractText(m.content)).trim();
    if (!text) continue;
    out.push({
      id: `msg_${Date.now()}_${randomBytes(3).toString('hex')}`,
      role: m.role,
      content: text,
      timestamp: m.timestamp ?? Date.now(),
    });
  }
  return out;
}

/**
 * 把每轮对话的 user/assistant 消息增量、清洗后写入 JSONL 文件
 * （{baseDir}/conversations/YYYY-MM-DD.jsonl），作为 L1 提取的输入真源。
 */
export async function recordConversation(params: RecordConversationParams): Promise<L0MessageRecord[]> {
  const {
    sessionKey,
    sessionId = sessionKey,
    userId,
    agentId,
    messages,
    baseDir,
    originalUserText,
    afterTimestamp,
  } = params;

  const recordedAt = new Date().toISOString();
  const extracted = extractUserAssistantMessages(messages, {
    sessionKey,
    sessionId,
    userId,
    agentId,
    recordedAt,
  });

  // originalUserText 替换污染 user 消息：按 timestamp 匹配第一条 user 消息替换 content
  if (originalUserText !== undefined) {
    const target = extracted.find((m) => m.role === 'user');
    if (target) target.content = originalUserText;
  }

  const filtered = afterTimestamp === undefined ? extracted : extracted.filter((m) => m.timestamp > afterTimestamp);
  if (filtered.length === 0) return [];

  const records: L0MessageRecord[] = filtered.map((m) => ({
    sessionKey,
    sessionId,
    userId,
    agentId,
    recordedAt,
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));

  const dayDir = join(baseDir, 'conversations');
  mkdirSync(dayDir, { recursive: true });
  const file = join(dayDir, `${dateStr()}.jsonl`);
  for (const rec of records) {
    appendFileSync(file, `${JSON.stringify(rec)}\n`, 'utf-8');
  }

  return records;
}

/** 读取所有日文件（排序）→ 按 sessionKey 行级过滤 → timestamp > afterTimestamp → 截取最新 limit 条 */
export async function readConversationMessages(
  sessionKey: string,
  baseDir: string,
  afterTimestamp?: number,
  limit?: number,
): Promise<Array<{ role: string; content: string; timestamp: number }>> {
  const dayDir = join(baseDir, 'conversations');
  let files: string[];
  try {
    files = readdirSync(dayDir);
  } catch {
    return [];
  }

  const lines: Array<{ role: string; content: string; timestamp: number }> = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.jsonl')) continue;
    const raw = readFileSync(join(dayDir, file), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let rec: L0MessageRecord;
      try {
        rec = JSON.parse(trimmed) as L0MessageRecord;
      } catch {
        continue;
      }
      if (rec.sessionKey !== sessionKey) continue;
      if (afterTimestamp !== undefined && !(rec.timestamp > afterTimestamp)) continue;
      lines.push({ role: rec.role, content: rec.content, timestamp: rec.timestamp });
    }
  }

  // 按 timestamp 升序整体排序（日文件已排序，此处兜底），再截取最新 limit 条
  lines.sort((a, b) => a.timestamp - b.timestamp);
  const sliced = limit !== undefined && lines.length > limit ? lines.slice(lines.length - limit) : lines;
  return sliced;
}
