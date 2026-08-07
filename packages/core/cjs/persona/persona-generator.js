var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/persona/persona-generator.ts
var persona_generator_exports = {};
__export(persona_generator_exports, {
  PersonaGenerator: () => PersonaGenerator
});
module.exports = __toCommonJS(persona_generator_exports);
var import_fs = require("fs");
var import_persona_generation = require("../prompts/persona-generation.js");
var PersonaGenerator = class {
  constructor(opts) {
    this.llm = opts.llm;
    this.personaPath = opts.personaPath;
    this.dataDir = opts.dataDir;
    this.team = opts.team;
    this.agent = opts.agent;
  }
  /**
   * 运行 L3 Persona 生成管线：组 prompt → LLM 单次调用 → 工程侧写文件 → 读回校验。
   */
  async generatePersona(params) {
    const { mode, existingPersona, changedScenes } = params;
    const prompt = this.buildUserPrompt({ mode, existingPersona, changedScenes });
    const systemPrompt = (0, import_persona_generation.buildPersonaSystemPrompt)();
    const content = await this.llm.run({
      prompt,
      systemPrompt,
      taskId: "l3-persona-generation",
      timeoutMs: 18e4
    });
    const personaPath = this.writePersona(content);
    const success = this.validatePersona(personaPath);
    return { success, content, personaPath };
  }
  // ============================
  // Prompt assembly
  // ============================
  buildUserPrompt(params) {
    const { mode, existingPersona, changedScenes } = params;
    const modeLabel = mode === "first" ? "🆕 首次生成" : "🔄 迭代更新";
    const changedSection = changedScenes.length > 0 ? `
## 📄 变化场景完整内容

*自上次 Persona 更新后，以下 ${changedScenes.length} 个场景发生了变化。工程已为你预加载完整内容：*

` + changedScenes.map(
      (s, i) => `### [${i + 1}] updated=${s.updated}

\`\`\`markdown
${s.content}
\`\`\``
    ).join("\n\n") + `

---

⚠️ **重点分析变化场景**：上述场景是自上次更新后的**新增/修改内容**，请**重点分析**这些场景中的新信息。
` : `
⚠️ **无变化场景**：本次不提供变化场景内容，仅基于现有 persona 进行审视。
`;
    const existingSection = existingPersona ? `
## 📄 当前 Persona（工程已预加载，无需 read）

*以下是现有 persona.md 的完整内容（${existingPersona.length} 字符），基于此更新后请控制在 2000 字内：*

\`\`\`markdown
${existingPersona}
\`\`\`

---
` : "";
    return `**输出语言**：\`persona.md\` 使用下方变化场景内容的主导语言。

**⏰ 更新时间**: ${(/* @__PURE__ */ new Date()).toISOString()}
**模式**: ${modeLabel}
**变化场景**: ${changedScenes.length} 个

---
${changedSection}
${existingSection}`;
  }
  // ============================
  // Engineering-side persistence + validation
  // ============================
  writePersona(content) {
    (0, import_fs.writeFileSync)(this.personaPath, content, "utf8");
    return this.personaPath;
  }
  validatePersona(personaPath) {
    try {
      const text = (0, import_fs.readFileSync)(personaPath, "utf-8");
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersonaGenerator
});
