/**
 * L2 Scene 提取提示词（chat 版）：角色"Memory Consolidation Architect"，
 * 叙事整合 UPDATE>MERGE>CREATE + 热度管理 + [DELETED] 软删除 + JSON 输出契约。
 *
 * 依据权威蓝图 §4.2：形态是"不是清单，是连贯的叙事文档"；动作 Create/Integrate/Rewrite；
 * 策略优先级 UPDATE(首选) > MERGE > CREATE（最后手段，每次批处理最多新增 1 个场景，
 * 必须 read 检查至少 2 个最相似场景）；MERGE 后必须用 [DELETED] 标记删旧文件；
 * 热度规则：新建 heat:1、更新 old+1、合并 sum+1。
 *
 * 与 L1 提示词（l1-extraction.ts）的结构对齐：输出语言声明 → 角色定义 → 输入 →
 * 工作流/策略 → 热度 → 输出契约。文件操作由工程侧完成（extractL2 落盘），
 * 因此这里输出的是一次性 JSON 决策契约，而不是直接操作文件的指令。
 */
/**
 * 构建 L2 Scene 提取的 system prompt。
 * @param maxScenes 场景文件数量上限（参照 §4.2 的分级预警，默认 50；0/负数视为不限制）
 */
export declare function buildSceneSystemPrompt(maxScenes?: number): string;
//# sourceMappingURL=scene-extraction.d.ts.map