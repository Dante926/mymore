/**
 * L3 Persona 生成提示词（chat 版）：角色 "Persona Architect - Incremental Evolution Protocol"，
 * 四层深度扫描（🟢 Base & Facts / 🔵 Interest Graph / 🟡 Interface / 🔴 Core）
 * + 增量演化（first/incremental 模式 + 迭代决策强化/补充/修正/重构/不改）+
 * 输出模板（Archetype + 基本信息/长期偏好 + Chapter 1-4）。
 *
 * 依据权威蓝图 §5.1 编写。与 L1/L2 提示词的结构对齐：
 * 工程侧先落盘后读回校验，因此这里输出的是完整 persona.md 文本契约
 * （LLM 返回正文，工程侧 writeFileSync 写入 persona.md）。
 */
/**
 * 构建 L3 Persona 生成的 system prompt。
 *
 * @returns 四层扫描 + 输出模板 + 文件操作/内容约束的完整系统提示词
 */
export declare function buildPersonaSystemPrompt(): string;
//# sourceMappingURL=persona-generation.d.ts.map