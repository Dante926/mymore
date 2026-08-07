/**
 * L3 Persona Generator：生成/更新用户画像 persona.md。
 *
 * 管线（对齐权威蓝图 §5.2 的工程侧职责，LLM 不直接写文件）：
 * 1. 组 user prompt：模式（first/incremental）+ 现有 persona（incremental 时预加载）
 *    + 变化场景内容（changedScenes）
 * 2. 调 LLM 单次调用（systemPrompt = buildPersonaSystemPrompt()），返回即 persona.md 全文
 * 3. 工程侧 writeFileSync 写入 personaPath
 * 4. 读回校验非空 → { success, content, personaPath }
 *
 * 与 L2 SceneExtractor 的结构对齐：构造注入 llm → generatePersona(params) → 单次调用。
 */

import { writeFileSync, readFileSync } from 'fs';
import type { LLMRunner } from '../llm.js';
import { buildPersonaSystemPrompt } from '../prompts/persona-generation.js';

// ============================
// Types
// ============================

export type PersonaMode = 'first' | 'incremental';

export interface ChangedScene {
  content: string;
  updated: string;
}

export interface PersonaGenerateParams {
  mode: PersonaMode;
  existingPersona?: string;
  changedScenes: ChangedScene[];
}

export interface PersonaResult {
  success: boolean;
  content: string;
  personaPath: string;
}

export interface PersonaGeneratorOptions {
  llm: LLMRunner;
  personaPath: string;
  dataDir: string;
  team?: string;
  agent?: string;
}

// ============================
// Generator
// ============================

export class PersonaGenerator {
  private readonly llm: LLMRunner;
  private readonly personaPath: string;
  private readonly dataDir: string;
  private readonly team?: string;
  private readonly agent?: string;

  constructor(opts: PersonaGeneratorOptions) {
    this.llm = opts.llm;
    this.personaPath = opts.personaPath;
    this.dataDir = opts.dataDir;
    this.team = opts.team;
    this.agent = opts.agent;
  }

  /**
   * 运行 L3 Persona 生成管线：组 prompt → LLM 单次调用 → 工程侧写文件 → 读回校验。
   */
  async generatePersona(params: PersonaGenerateParams): Promise<PersonaResult> {
    const { mode, existingPersona, changedScenes } = params;

    const prompt = this.buildUserPrompt({ mode, existingPersona, changedScenes });
    const systemPrompt = buildPersonaSystemPrompt();
    const content = await this.llm.run({
      prompt,
      systemPrompt,
      taskId: 'l3-persona-generation',
      timeoutMs: 180_000,
    });

    const personaPath = this.writePersona(content);
    const success = this.validatePersona(personaPath);
    return { success, content, personaPath };
  }

  // ============================
  // Prompt assembly
  // ============================

  private buildUserPrompt(params: PersonaGenerateParams): string {
    const { mode, existingPersona, changedScenes } = params;
    const modeLabel = mode === 'first' ? '🆕 首次生成' : '🔄 迭代更新';

    const changedSection =
      changedScenes.length > 0
        ? `\n## 📄 变化场景完整内容\n\n` +
          `*自上次 Persona 更新后，以下 ${changedScenes.length} 个场景发生了变化。工程已为你预加载完整内容：*\n\n` +
          changedScenes
            .map(
              (s, i) =>
                `### [${i + 1}] updated=${s.updated}\n\n\`\`\`markdown\n${s.content}\n\`\`\``,
            )
            .join('\n\n') +
          `\n\n---\n\n` +
          `⚠️ **重点分析变化场景**：上述场景是自上次更新后的**新增/修改内容**，请**重点分析**这些场景中的新信息。\n`
        : `\n⚠️ **无变化场景**：本次不提供变化场景内容，仅基于现有 persona 进行审视。\n`;

    const existingSection = existingPersona
      ? `\n## 📄 当前 Persona（工程已预加载，无需 read）\n\n` +
        `*以下是现有 persona.md 的完整内容（${existingPersona.length} 字符），基于此更新后请控制在 2000 字内：*\n\n` +
        `\`\`\`markdown\n${existingPersona}\n\`\`\`\n\n---\n`
      : '';

    return `**输出语言**：\`persona.md\` 使用下方变化场景内容的主导语言。

**⏰ 更新时间**: ${new Date().toISOString()}
**模式**: ${modeLabel}
**变化场景**: ${changedScenes.length} 个

---
${changedSection}
${existingSection}`;
  }

  // ============================
  // Engineering-side persistence + validation
  // ============================

  private writePersona(content: string): string {
    writeFileSync(this.personaPath, content, 'utf8');
    return this.personaPath;
  }

  private validatePersona(personaPath: string): boolean {
    try {
      const text = readFileSync(personaPath, 'utf-8');
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }
}
