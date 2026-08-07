export interface SceneMeta {
    created: string;
    updated: string;
    summary: string;
    heat: number;
}
export interface SceneFile {
    path: string;
    meta: SceneMeta;
    body: string;
}
export interface SceneIndexEntry {
    path: string;
    summary: string;
    heat: number;
    updated: string;
}
/** Parse a `-----META-START----- ... -----META-END-----` + body scene file. */
export declare function parseSceneFile(raw: string): SceneFile | null;
/** Rebuild the META block + body for a scene file. */
export declare function serializeSceneFile(scene: SceneFile): string;
/** Strip a scene name to alphanumeric/CJK/`-`/`_`/`.` only; fallback `scene`. */
export declare function sanitizeSceneName(name: string): string;
/** Scan `scene_blocks/*.md`, build entries, sort by heat desc, write `scene_index.json`. */
export declare function syncSceneIndex(scenesDir: string): SceneIndexEntry[];
//# sourceMappingURL=scene-file.d.ts.map