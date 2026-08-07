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
import type { LLMRunner } from '../llm.js';
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
export declare class PersonaGenerator {
    private readonly llm;
    private readonly personaPath;
    private readonly dataDir;
    private readonly team?;
    private readonly agent?;
    constructor(opts: PersonaGeneratorOptions);
    /**
     * 运行 L3 Persona 生成管线：组 prompt → LLM 单次调用 → 工程侧写文件 → 读回校验。
     */
    generatePersona(params: PersonaGenerateParams): Promise<PersonaResult>;
    private buildUserPrompt;
    private writePersona;
    private validatePersona;
}
//# sourceMappingURL=persona-generator.d.ts.map