function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import { mkdirSync, appendFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
function dateStr() {
  var d = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Date();
  return d.toISOString().slice(0, 10);
}

/** 生成唯一记忆 id：rec_{ts}_{3 字节 hex} */
export function generateMemoryId() {
  return "rec_".concat(Date.now(), "_").concat(randomBytes(3).toString('hex'));
}

/**
 * 把一条结构化记忆记录 append 到 {baseDir}/records/YYYY-MM-DD.jsonl
 * （所有 team 共用同一份文件，读取时按 team/agent 行级过滤），返回 record.id。
 */
export function appendL1Record(record, baseDir, _team, _agent) {
  var dayDir = join(baseDir, 'records');
  mkdirSync(dayDir, {
    recursive: true
  });
  var file = join(dayDir, "".concat(dateStr(), ".jsonl"));
  appendFileSync(file, "".concat(JSON.stringify(record), "\n"), 'utf-8');
  return record.id;
}

/** 读取所有日文件（排序）→ 按 team/agent 行级过滤 → version > afterVersion → 截取最新 limit 条 */
export function readL1Records(baseDir) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var afterVersion = opts.afterVersion,
    team = opts.team,
    agent = opts.agent,
    limit = opts.limit;
  var dayDir = join(baseDir, 'records');
  var files;
  try {
    files = readdirSync(dayDir);
  } catch (_unused) {
    return [];
  }
  var records = [];
  var _iterator = _createForOfIteratorHelper(files.sort()),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var file = _step.value;
      if (!file.endsWith('.jsonl')) continue;
      var raw = readFileSync(join(dayDir, file), 'utf-8');
      var _iterator2 = _createForOfIteratorHelper(raw.split('\n')),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var line = _step2.value;
          var trimmed = line.trim();
          if (!trimmed) continue;
          var rec = void 0;
          try {
            rec = JSON.parse(trimmed);
          } catch (_unused2) {
            continue;
          }
          if (team !== undefined && rec.team !== team) continue;
          if (agent !== undefined && rec.agent !== agent) continue;
          if (afterVersion !== undefined && !(rec.version > afterVersion)) continue;
          records.push(rec);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }

    // 按 created_at 降序整体排序，再截取最新 limit 条
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  records.sort(function (a, b) {
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });
  if (limit !== undefined && records.length > limit) return records.slice(0, limit);
  return records;
}

/** 线性扫描取单条记录（记录量小，暂不优化） */
export function getL1Record(id, baseDir) {
  var _readL1Records$find;
  return (_readL1Records$find = readL1Records(baseDir).find(function (r) {
    return r.id === id;
  })) !== null && _readL1Records$find !== void 0 ? _readL1Records$find : null;
}