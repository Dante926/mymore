import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

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

const META_RE = /-----META-START-----\n([\s\S]*?)\n-----META-END-----\n?\n?/;

/** Parse a `-----META-START----- ... -----META-END-----` + body scene file. */
export function parseSceneFile(raw: string): SceneFile | null {
  const match = META_RE.exec(raw);
  if (!match) return null;
  const metaBlock = match[1];
  const meta: Partial<SceneMeta> = {};
  for (const line of metaBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'created') meta.created = value;
    else if (key === 'updated') meta.updated = value;
    else if (key === 'summary') meta.summary = value;
    else if (key === 'heat') {
      const n = Number(value);
      meta.heat = Number.isFinite(n) ? n : 0;
    }
  }
  if (meta.created === undefined || meta.updated === undefined || meta.summary === undefined || meta.heat === undefined) {
    return null;
  }
  const body = raw.slice(match[0].length).replace(/^\n+/, '');
  return { path: '', meta: meta as SceneMeta, body };
}

/** Rebuild the META block + body for a scene file. */
export function serializeSceneFile(scene: SceneFile): string {
  const { meta } = scene;
  const metaBlock = [
    '-----META-START-----',
    `created: ${meta.created}`,
    `updated: ${meta.updated}`,
    `summary: ${meta.summary}`,
    `heat: ${meta.heat}`,
    '-----META-END-----',
  ].join('\n');
  return `${metaBlock}\n\n${scene.body}`;
}

/** Strip a scene name to alphanumeric/CJK/`-`/`_`/`.` only; fallback `scene`. */
export function sanitizeSceneName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9一-鿿_.-]/g, '');
  return cleaned === '' ? 'scene' : cleaned;
}

/** Scan `scene_blocks/*.md`, build entries, sort by heat desc, write `scene_index.json`. */
export function syncSceneIndex(scenesDir: string): SceneIndexEntry[] {
  // Scene files live in `scene_blocks/`; fall back to `scenesDir` itself when the
  // subdirectory doesn't exist (matches the task-1 test which writes files flat).
  const sceneBlocksDir = join(scenesDir, 'scene_blocks');
  const scanDir = existsSync(sceneBlocksDir) ? sceneBlocksDir : scenesDir;
  let files: string[];
  try {
    files = readdirSync(scanDir).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }
  const entries: SceneIndexEntry[] = [];
  for (const f of files) {
    const raw = readFileSync(join(scanDir, f), 'utf8');
    const scene = parseSceneFile(raw);
    if (!scene) continue;
    entries.push({ path: f, summary: scene.meta.summary, heat: scene.meta.heat, updated: scene.meta.updated });
  }
  entries.sort((a, b) => b.heat - a.heat);
  writeFileSync(join(scenesDir, 'scene_index.json'), JSON.stringify(entries, null, 2), 'utf8');
  return entries;
}
