/**
 * L2 Scene Extractor：单次 LLM 调用把本批 L1 记忆碎片整合进 `scene_blocks/*.md` 叙事文档。
 *
 * 管线（对齐权威蓝图 §4.2 / §4.4 的工程侧职责）：
 * 1. 组装 prompt：现有场景清单（path/summary/heat/body）+ 新 L1 记录 → LLM 单次调用
 * 2. parseSceneDecision：剥代码块 → 括号平衡抽第一个 {...} → sanitize 控制字符 →
 *    JSON.parse 失败 repair 重试一次 → 逐字段校验补默认（容错风格同 L1）
 * 3. 应用动作：
 *    - update：写 target_path 新内容 + 保留 created，更新 updated/summary/heat（old+1 或 LLM heat）
 *    - create：写新文件（sanitize scene_name 后保证 .md 后缀），heat=1（LLM 正常给 1）
 *    - merge：合并内容写 target_path（heat sum+1），deleted_paths 文件写 [DELETED] 软删除标记
 * 4. 动作后调 syncSceneIndex(scenesDir) 重建 scene_index.json（LLM 不可见，工程侧维护）
 * 5. 返回 L2Result（personaUpdateRequested 来自 request_persona_update）
 *
 * 失败处理：LLM 抛错 → 抛错（调用方决定降级）；解析失败/动作非法 → 返回默认 update 空结果。
 */
import type { LLMRunner } from '../llm.js';
import type { L1Record } from '../record/l1-writer.js';
import type { SceneFile, SceneIndexEntry } from './scene-file.js';
export type L2Action = 'update' | 'merge' | 'create';
export interface L2Result {
    action: L2Action;
    targetPath?: string;
    content: string;
    newSceneName?: string;
    deletedPaths?: string[];
    personaUpdateRequested: boolean;
    summary: string;
    heat: number;
}
export interface L2ExtractParams {
    newRecords: L1Record[];
    existingScenes: SceneFile[];
    lastSceneIndex: SceneIndexEntry[];
}
export interface SceneExtractorOptions {
    llm: LLMRunner;
    scenesDir: string;
    team?: string;
    agent?: string;
    /** 场景文件数量上限（默认 50，0 表示不限制） */
    maxScenes?: number;
}
interface SceneDecision {
    action: string;
    target_path?: string;
    content?: string;
    scene_name?: string;
    deleted_paths?: string[];
    request_persona_update?: boolean;
    summary?: string;
    heat?: number;
}
export declare class SceneExtractor {
    private readonly llm;
    private readonly scenesDir;
    private readonly team?;
    private readonly agent?;
    private readonly maxScenes;
    constructor(opts: SceneExtractorOptions);
    /**
     * 运行 L2 提取管线：组 prompt → LLM 单次调用 → 解析 JSON → 应用动作 → 重建索引。
     */
    extractL2(params: L2ExtractParams): Promise<L2Result>;
    private buildPrompt;
    private indent;
    private applyDecision;
    /** 按原始文件名写入场景（create 用，fileName 已 sanitizeSceneName 归一，仍走 resolve 消毒）。 */
    private writeScene;
    /** 按已 resolve 的绝对路径写入（update/merge 用，路径已通过 resolveScenePath 断言在 scenesDir 内）。 */
    private writeSceneResolved;
    /** 软删除：把文件内容覆写为 [DELETED] 标记（对齐蓝图 §4.2 / 参考实现：空字符串会被拒绝）。 */
    private softDelete;
    /** 场景文件的扫描目录：`scene_blocks/` 存在则用之，否则退回 scenesDir（与 syncSceneIndex 一致）。 */
    private scanDir;
    /**
     * 路径消毒（防逃逸）：把 LLM 提供的文件名 resolve 后断言其位于 scenesDir 内。
     * `../x.md`、绝对路径、嵌套目录越界等一律拒绝并抛错，绝不写出 scenesDir。
     */
    private resolveScenePath;
}
/**
 * 把 LLM 输出的 JSON 响应解析为 SceneDecision。
 * 容错链（风格同 L1 parseExtractionResult）：
 * 剥代码块 → 括号平衡抽第一个 {...} → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 → 逐字段校验。
 */
export declare function parseSceneDecision(raw: string): SceneDecision;
export {};
//# sourceMappingURL=scene-extractor.d.ts.map