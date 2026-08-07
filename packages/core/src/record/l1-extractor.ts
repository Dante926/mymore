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
import { EXTRACT_MEMORIES_SYSTEM_PROMPT, formatExtractionPrompt } from '../prompts/l1-extraction.js';
import type { LLMRunner } from '../llm.js';
import { appendL1Record, generateMemoryId } from './l1-writer.js';
import type { L1Record, L1RecordType } from './l1-writer.js';

// ============================
// Types
// ============================

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

// ============================
// Core function
// ============================

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
export async function extractL1Memories(params: ExtractL1Params): Promise<L1ExtractionResult> {
  const {
    messages,
    llm,
    baseDir,
    sessionKey,
    maxMessagesPerExtraction = 10,
    maxBackgroundMessages = 5,
    maxMemoriesPerSession = 10,
    previousSceneName,
  } = params;

  if (messages.length === 0) {
    return { success: true, extractedCount: 0, storedCount: 0, records: [], sceneNames: [] };
  }

  // 切分：newMessages 取最后 N 条；backgroundMessages 取紧邻前最多 M 条（仅上下文，严禁提取）
  const newMessages = messages.slice(-maxMessagesPerExtraction);
  const bgEndIdx = messages.length - newMessages.length;
  const backgroundMessages =
    bgEndIdx > 0 ? messages.slice(Math.max(0, bgEndIdx - maxBackgroundMessages), bgEndIdx) : [];

  // Step 1: LLM 提取（情境切分 + 记忆提取）
  let scenes: SceneSegment[];
  try {
    scenes = await callLlmExtraction({ newMessages, backgroundMessages, previousSceneName, llm });
  } catch (err) {
    // LLM 抛错 → success:false 全 0
    return { success: false, extractedCount: 0, storedCount: 0, records: [], sceneNames: [] };
  }

  // Step 2: 展平所有场景的记忆，逐条 normalizeType + 补默认值
  const sceneNames: string[] = [];
  const extracted: Array<{
    content: string;
    type: L1RecordType;
    priority: number;
    source_message_ids: string[];
    metadata: Record<string, unknown>;
    scene_name: string;
  }> = [];

  for (const scene of scenes) {
    sceneNames.push(scene.scene_name);
    for (const mem of scene.memories) {
      const memType = normalizeType(mem.type);
      if (!memType) continue; // 非法 type 跳过
      extracted.push({
        content: mem.content,
        type: memType,
        priority: typeof mem.priority === 'number' ? mem.priority : 50,
        source_message_ids: Array.isArray(mem.source_message_ids) ? mem.source_message_ids.map(String) : [],
        metadata: mem.metadata && typeof mem.metadata === 'object' ? mem.metadata : {},
        scene_name: scene.scene_name,
      });
    }
  }

  // maxMemoriesPerSession 截断
  if (extracted.length > maxMemoriesPerSession) {
    extracted.length = maxMemoriesPerSession;
  }

  // Step 3: 构建 L1Record 并落盘
  const records: L1Record[] = [];
  for (const mem of extracted) {
    const record: L1Record = {
      id: generateMemoryId(),
      type: mem.type,
      content: mem.content,
      priority: mem.priority,
      scene_name: mem.scene_name,
      source_message_ids: mem.source_message_ids,
      created_at: new Date().toISOString(),
      version: 1,
    };
    try {
      appendL1Record(record, baseDir);
      records.push(record);
    } catch (err) {
      // 单条写失败 warn 跳过，不中断批次
      console.warn(
        `[l1-extractor] write failed for memory "${record.content.slice(0, 50)}...": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    success: true,
    extractedCount: extracted.length,
    storedCount: records.length,
    records,
    sceneNames,
    lastSceneName: sceneNames.length > 0 ? sceneNames[sceneNames.length - 1] : undefined,
  };
}

// ============================
// LLM call
// ============================

async function callLlmExtraction(params: {
  newMessages: ConversationMessage[];
  backgroundMessages: ConversationMessage[];
  previousSceneName?: string;
  llm: LLMRunner;
}): Promise<SceneSegment[]> {
  const { newMessages, backgroundMessages, previousSceneName, llm } = params;

  const systemPrompt = EXTRACT_MEMORIES_SYSTEM_PROMPT;
  const prompt = formatExtractionPrompt({ newMessages, backgroundMessages, previousSceneName });

  const raw = await llm.run({
    prompt,
    systemPrompt,
    taskId: 'l1-extraction',
    timeoutMs: 180_000,
  });

  return parseExtractionResult(raw);
}

// ============================
// Parse tolerance（§3.4）
// ============================

/**
 * 把 LLM 输出的 JSON 响应解析为 SceneSegment[]。
 * 容错链：剥代码块 → 正则抽第一个 [...] → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 →
 * 逐字段补默认（scene_name→"未知情境"，type→"episodic"，priority→50，source_message_ids→[]，metadata→{}）。
 */
export function parseExtractionResult(raw: string): SceneSegment[] {
  try {
    // 1. 剥 markdown 代码块
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // 2. 正则抽第一个 [...]
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];

    // 3. sanitize 控制字符
    const sanitized = sanitizeJsonForParse(arrayMatch[0]);

    // 4. JSON.parse，失败则 repair 重试一次
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized) as unknown;
    } catch {
      const repaired = repairExtractionJson(sanitized);
      parsed = JSON.parse(repaired) as unknown;
    }

    if (!Array.isArray(parsed)) return [];

    // 5. 逐 scene 结构化校验 + 补默认值（不全量丢弃）
    const scenes: SceneSegment[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;

      scenes.push({
        scene_name: typeof s.scene_name === 'string' ? s.scene_name : '未知情境',
        message_ids: Array.isArray(s.message_ids) ? s.message_ids.map(String) : [],
        memories: Array.isArray(s.memories)
          ? (s.memories as Array<Record<string, unknown>>)
              .filter(
                (m) =>
                  m &&
                  typeof m === 'object' &&
                  typeof m.content === 'string' &&
                  (m.content as string).length > 0,
              )
              .map((m) => ({
                content: String(m.content),
                type: String(m.type ?? 'episodic'),
                priority: typeof m.priority === 'number' ? m.priority : 50,
                source_message_ids: Array.isArray(m.source_message_ids)
                  ? m.source_message_ids.map(String)
                  : [],
                metadata:
                  m.metadata && typeof m.metadata === 'object'
                    ? (m.metadata as Record<string, unknown>)
                    : {},
              }))
          : [],
      });
    }

    return scenes;
  } catch {
    return [];
  }
}

/**
 * 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F）。
 * 先尝试完整转义并验证解析；仍失败则暴力剥离无文本含义的控制字符（保留 \t \n \r）。
 */
function sanitizeJsonForParse(raw: string): string {
  const escaped = escapeControlCharsInJsonStrings(raw);
  try {
    JSON.parse(escaped);
    return escaped;
  } catch {
    return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }
}

/** 逐字符遍历 JSON 文本，把字符串字面量内的控制字符转为短转义或 \uXXXX。 */
function escapeControlCharsInJsonStrings(raw: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (ch === '\\') {
        out += ch + (raw[i + 1] ?? '');
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        switch (ch) {
          case '\n':
            out += '\\n';
            break;
          case '\r':
            out += '\\r';
            break;
          case '\t':
            out += '\\t';
            break;
          case '\b':
            out += '\\b';
            break;
          case '\f':
            out += '\\f';
            break;
          default:
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        }
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * repair 裸标识符优先级 + 去尾逗号：
 * - `"priority": sheet`（裸标识符）→ `"priority": 50`
 * - 数组/对象尾逗号 `,}` / `,]` → 去除
 */
function repairExtractionJson(json: string): string {
  return json
    .replace(
      /("priority"\s*:\s*)(?!-?\d+(?:\.\d+)?\s*[,}]|"[^"\\]*(?:\\.[^"\\]*)*"\s*[,}])([\s\S]*?)(?=,\s*"(?:content|type|priority|source_message_ids|metadata)"\s*:|[}\]])/g,
      (_m, prefix: string) => `${prefix}50`,
    )
    .replace(/,\s*([}\]])/g, '$1');
}

// ============================
// Type normalization
// ============================

const VALID_TYPES: L1RecordType[] = [
  'persona',
  'episodic',
  'instruction',
  'work_fact',
  'work_task',
  'work_method',
  'work_artifact',
];

/**
 * 类型归一化：7 种合法类型 + legacy 别名映射（episode→episodic, instruct→instruction,
 * preference→persona）；非法返回 null（调用方跳过该条）。
 */
function normalizeType(raw: string): L1RecordType | null {
  const lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower as L1RecordType)) {
    return lower as L1RecordType;
  }
  if (lower === 'episode') return 'episodic';
  if (lower === 'instruct') return 'instruction';
  if (lower === 'preference') return 'persona';
  return null;
}
