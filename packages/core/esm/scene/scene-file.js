function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
var META_RE = /-----META-START-----\n([\s\S]*?)\n-----META-END-----\n?\n?/;

/** Parse a `-----META-START----- ... -----META-END-----` + body scene file. */
export function parseSceneFile(raw) {
  var match = META_RE.exec(raw);
  if (!match) return null;
  var metaBlock = match[1];
  var meta = {};
  var _iterator = _createForOfIteratorHelper(metaBlock.split('\n')),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var line = _step.value;
      var idx = line.indexOf(':');
      if (idx === -1) continue;
      var key = line.slice(0, idx).trim();
      var value = line.slice(idx + 1).trim();
      if (key === 'created') meta.created = value;else if (key === 'updated') meta.updated = value;else if (key === 'summary') meta.summary = value;else if (key === 'heat') {
        var n = Number(value);
        meta.heat = Number.isFinite(n) ? n : 0;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  if (meta.created === undefined || meta.updated === undefined || meta.summary === undefined || meta.heat === undefined) {
    return null;
  }
  var body = raw.slice(match[0].length).replace(/^\n+/, '');
  return {
    path: '',
    meta: meta,
    body: body
  };
}

/** Rebuild the META block + body for a scene file. */
export function serializeSceneFile(scene) {
  var meta = scene.meta;
  var metaBlock = ['-----META-START-----', "created: ".concat(meta.created), "updated: ".concat(meta.updated), "summary: ".concat(meta.summary), "heat: ".concat(meta.heat), '-----META-END-----'].join('\n');
  return "".concat(metaBlock, "\n\n").concat(scene.body);
}

/** Strip a scene name to alphanumeric/CJK/`-`/`_`/`.` only; fallback `scene`. */
export function sanitizeSceneName(name) {
  var cleaned = name.replace(/[^a-zA-Z0-9一-鿿_.-]/g, '');
  return cleaned === '' ? 'scene' : cleaned;
}

/** Scan `scene_blocks/*.md`, build entries, sort by heat desc, write `scene_index.json`. */
export function syncSceneIndex(scenesDir) {
  // Scene files live in `scene_blocks/`; fall back to `scenesDir` itself when the
  // subdirectory doesn't exist (matches the task-1 test which writes files flat).
  var sceneBlocksDir = join(scenesDir, 'scene_blocks');
  var scanDir = existsSync(sceneBlocksDir) ? sceneBlocksDir : scenesDir;
  var files;
  try {
    files = readdirSync(scanDir).filter(function (f) {
      return f.endsWith('.md');
    });
  } catch (_unused) {
    files = [];
  }
  var entries = [];
  var _iterator2 = _createForOfIteratorHelper(files),
    _step2;
  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var f = _step2.value;
      var raw = readFileSync(join(scanDir, f), 'utf8');
      // [DELETED] 软删除标记的文件（L2 merge 动作写入）不进入索引
      if (raw.trim() === '[DELETED]') continue;
      var scene = parseSceneFile(raw);
      if (!scene) continue;
      entries.push({
        path: f,
        summary: scene.meta.summary,
        heat: scene.meta.heat,
        updated: scene.meta.updated
      });
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }
  entries.sort(function (a, b) {
    return b.heat - a.heat;
  });
  writeFileSync(join(scenesDir, 'scene_index.json'), JSON.stringify(entries, null, 2), 'utf8');
  return entries;
}