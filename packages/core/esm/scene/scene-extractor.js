function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
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

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, sep } from 'path';
import { serializeSceneFile, sanitizeSceneName, syncSceneIndex } from "./scene-file.js";
import { buildSceneSystemPrompt } from "../prompts/scene-extraction.js";

// ============================
// Types
// ============================

// ============================
// Extractor
// ============================

var DEFAULT_MAX_SCENES = 50;
export var SceneExtractor = /*#__PURE__*/function () {
  function SceneExtractor(opts) {
    var _opts$maxScenes;
    _classCallCheck(this, SceneExtractor);
    _defineProperty(this, "llm", void 0);
    _defineProperty(this, "scenesDir", void 0);
    _defineProperty(this, "team", void 0);
    _defineProperty(this, "agent", void 0);
    _defineProperty(this, "maxScenes", void 0);
    this.llm = opts.llm;
    this.scenesDir = opts.scenesDir;
    this.team = opts.team;
    this.agent = opts.agent;
    this.maxScenes = (_opts$maxScenes = opts.maxScenes) !== null && _opts$maxScenes !== void 0 ? _opts$maxScenes : DEFAULT_MAX_SCENES;
  }

  /**
   * 运行 L2 提取管线：组 prompt → LLM 单次调用 → 解析 JSON → 应用动作 → 重建索引。
   */
  _createClass(SceneExtractor, [{
    key: "extractL2",
    value: (function () {
      var _extractL = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(params) {
        var newRecords, existingScenes, lastSceneIndex, prompt, systemPrompt, raw, decision;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              newRecords = params.newRecords, existingScenes = params.existingScenes, lastSceneIndex = params.lastSceneIndex;
              prompt = this.buildPrompt(newRecords, existingScenes, lastSceneIndex);
              systemPrompt = buildSceneSystemPrompt(this.maxScenes);
              _context.next = 5;
              return this.llm.run({
                prompt: prompt,
                systemPrompt: systemPrompt,
                taskId: 'l2-scene-extraction',
                timeoutMs: 180000
              });
            case 5:
              raw = _context.sent;
              decision = parseSceneDecision(raw);
              return _context.abrupt("return", this.applyDecision(decision, existingScenes));
            case 8:
            case "end":
              return _context.stop();
          }
        }, _callee, this);
      }));
      function extractL2(_x) {
        return _extractL.apply(this, arguments);
      }
      return extractL2;
    }() // ============================
    // Prompt assembly
    // ============================
    )
  }, {
    key: "buildPrompt",
    value: function buildPrompt(newRecords, existingScenes, lastSceneIndex) {
      var _this = this;
      var memoriesText = newRecords.length > 0 ? newRecords.map(function (r) {
        var parts = ["[id] ".concat(r.id), "[type] ".concat(r.type), "[priority] ".concat(r.priority), "[created_at] ".concat(r.created_at), "[content] ".concat(r.content)];
        if (r.scene_name) parts.push("[scene_name] ".concat(r.scene_name));
        return parts.join('\n');
      }).join('\n\n') : '（本批无新增记忆，仅做既有场景的整理/合并）';
      var scenesText = existingScenes.length > 0 ? existingScenes.map(function (s) {
        return "- path: ".concat(s.path, "\n  summary: ").concat(s.meta.summary, "\n  heat: ").concat(s.meta.heat, "\n  updated: ").concat(s.meta.updated, "\n  body:\n").concat(_this.indent(s.body, 4));
      }).join('\n\n') : '（当前无已有场景文件）';
      var indexText = lastSceneIndex.length > 0 ? lastSceneIndex.map(function (e) {
        return "- path: ".concat(e.path, " | summary: ").concat(e.summary, " | heat: ").concat(e.heat, " | updated: ").concat(e.updated);
      }).join('\n') : '（暂无索引快照）';
      return "**\u8F93\u51FA\u8BED\u8A00**\uFF1A`content`/`scene_name`/`summary` \u4F7F\u7528\u4E0B\u65B9 New Memories List \u4E2D\u8BB0\u5FC6\u7684\u4E3B\u5BFC\u8BED\u8A00\uFF1BJSON \u5B57\u6BB5\u540D\u4FDD\u6301\u82F1\u6587\u3002\n\n### 1\uFE0F\u20E3 New Memories List\n".concat(memoriesText, "\n\n### 2\uFE0F\u20E3 Existing Scene Blocks Summary\uFF08").concat(existingScenes.length, " \u4E2A\u573A\u666F\uFF09\n").concat(scenesText, "\n\n### 3\uFE0F\u20E3 Existing Scene Index\uFF08scene_index.json \u5FEB\u7167\uFF09\n").concat(indexText, "\n\n\u8BF7\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4E2D\u7684\u7B56\u7565\uFF08UPDATE \u9996\u9009 > MERGE > CREATE \u6700\u540E\u624B\u6BB5\uFF09\u8F93\u51FA JSON \u51B3\u7B56\u3002");
    }
  }, {
    key: "indent",
    value: function indent(text, spaces) {
      var pad = ' '.repeat(spaces);
      return text.split('\n').map(function (line) {
        return line.length > 0 ? pad + line : line;
      }).join('\n');
    }

    // ============================
    // Apply decision
    // ============================
  }, {
    key: "applyDecision",
    value: function () {
      var _applyDecision = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(decision, existingScenes) {
        var _decision$summary4;
        var action, sceneMap, now, deletedPaths, targetPath, newSceneName, content, heat, _decision$target_path, target, old, oldHeat, llmHeat, _old$meta$created, _decision$summary, deleted, _iterator, _step, p, oldFile, created, _old$meta$created2, _decision$summary2, _created, targetResolved, _decision$summary3, rawName, fileName;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              action = normalizeAction(decision.action);
              sceneMap = new Map(existingScenes.map(function (s) {
                return [s.path, s];
              }));
              now = new Date().toISOString();
              deletedPaths = [];
              content = ''; // heat 最终值：update/create/merge 各自的策略规则（§4.2 热度管理）计算，
              // 若 LLM 提供了合法正 heat 则以其为准。merge 的兜底 = sum(所有相关 block) + 1，
              // 因此从 0 起步累加（target + deleted）再 +1。
              heat = 0;
              if (!(action === 'update' || action === 'merge')) {
                _context2.next = 19;
                break;
              }
              target = (_decision$target_path = decision.target_path) !== null && _decision$target_path !== void 0 ? _decision$target_path : existingScenes.length > 0 ? existingScenes[0].path : undefined;
              if (target) {
                _context2.next = 10;
                break;
              }
              throw new Error("[scene-extractor] ".concat(action, " \u9700\u8981 target_path\uFF0C\u4F46 JSON \u672A\u63D0\u4F9B\u4E14\u65E0\u65E2\u6709\u573A\u666F\u53EF\u56DE\u9000"));
            case 10:
              targetPath = target;
              old = sceneMap.get(target);
              oldHeat = old ? old.meta.heat : 0;
              llmHeat = typeof decision.heat === 'number' && Number.isFinite(decision.heat) && decision.heat > 0 ? Math.floor(decision.heat) : 0;
              if (action === 'merge') {
                // 合并：热度 sum(所有相关 block) + 1；deleted_paths 软删除
                deleted = Array.isArray(decision.deleted_paths) ? decision.deleted_paths.map(String) : [];
                _iterator = _createForOfIteratorHelper(deleted);
                try {
                  for (_iterator.s(); !(_step = _iterator.n()).done;) {
                    p = _step.value;
                    oldFile = sceneMap.get(p);
                    if (oldFile) heat += oldFile.meta.heat;
                    this.softDelete(p);
                    deletedPaths.push(p);
                  }
                } catch (err) {
                  _iterator.e(err);
                } finally {
                  _iterator.f();
                }
                heat += oldHeat + 1; // sum(target + deleted) + 1
                if (llmHeat > 0) heat = llmHeat;
                created = (_old$meta$created = old === null || old === void 0 ? void 0 : old.meta.created) !== null && _old$meta$created !== void 0 ? _old$meta$created : now.slice(0, 10);
                content = normalizeContent(decision.content, created, now, (_decision$summary = decision.summary) !== null && _decision$summary !== void 0 ? _decision$summary : '', heat);
              } else {
                // 更新：热度 old + 1（或采用 LLM 校验后的 heat）；保留 created
                heat = llmHeat > 0 ? llmHeat : oldHeat + 1;
                _created = (_old$meta$created2 = old === null || old === void 0 ? void 0 : old.meta.created) !== null && _old$meta$created2 !== void 0 ? _old$meta$created2 : now.slice(0, 10);
                content = normalizeContent(decision.content, _created, now, (_decision$summary2 = decision.summary) !== null && _decision$summary2 !== void 0 ? _decision$summary2 : '', heat);
              }

              // 路径消毒：update/merge 的 target_path 必须 resolve 后落在 scenesDir 内，否则拒绝
              targetResolved = this.resolveScenePath(targetPath);
              this.writeSceneResolved(targetResolved, content);
              _context2.next = 27;
              break;
            case 19:
              // create：写新文件（sanitize scene_name 归一，保证 .md 后缀），heat=1。
              // newSceneName 保留 LLM 给出的原始名称（展示用），targetPath 为归一后的文件名。
              rawName = decision.scene_name && decision.scene_name.trim().length > 0 ? decision.scene_name : "scene-".concat(Date.now());
              fileName = sanitizeSceneName(rawName);
              if (!fileName.endsWith('.md')) fileName = "".concat(fileName, ".md");
              newSceneName = rawName;
              targetPath = fileName;
              heat = 1;
              content = normalizeContent(decision.content, now.slice(0, 10), now, (_decision$summary3 = decision.summary) !== null && _decision$summary3 !== void 0 ? _decision$summary3 : '', heat);
              this.writeScene(fileName, content);
            case 27:
              // 动作后重建 scene_index.json（工程侧维护，LLM 不可见）
              syncSceneIndex(this.scenesDir);
              return _context2.abrupt("return", {
                action: action,
                targetPath: targetPath,
                content: content,
                newSceneName: newSceneName,
                deletedPaths: deletedPaths.length > 0 ? deletedPaths : undefined,
                personaUpdateRequested: decision.request_persona_update === true,
                summary: (_decision$summary4 = decision.summary) !== null && _decision$summary4 !== void 0 ? _decision$summary4 : '',
                heat: heat
              });
            case 29:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this);
      }));
      function applyDecision(_x2, _x3) {
        return _applyDecision.apply(this, arguments);
      }
      return applyDecision;
    }() /** 按原始文件名写入场景（create 用，fileName 已 sanitizeSceneName 归一，仍走 resolve 消毒）。 */
  }, {
    key: "writeScene",
    value: function writeScene(fileName, content) {
      this.writeSceneResolved(this.resolveScenePath(fileName), content);
    }

    /** 按已 resolve 的绝对路径写入（update/merge 用，路径已通过 resolveScenePath 断言在 scenesDir 内）。 */
  }, {
    key: "writeSceneResolved",
    value: function writeSceneResolved(fullPath, content) {
      mkdirSync(this.scanDir(), {
        recursive: true
      });
      writeFileSync(fullPath, content, 'utf8');
    }

    /** 软删除：把文件内容覆写为 [DELETED] 标记（对齐蓝图 §4.2 / 参考实现：空字符串会被拒绝）。 */
  }, {
    key: "softDelete",
    value: function softDelete(fileName) {
      var full = this.resolveScenePath(fileName);
      if (existsSync(full)) {
        writeFileSync(full, '[DELETED]', 'utf8');
      }
    }

    /** 场景文件的扫描目录：`scene_blocks/` 存在则用之，否则退回 scenesDir（与 syncSceneIndex 一致）。 */
  }, {
    key: "scanDir",
    value: function scanDir() {
      var sceneBlocksDir = join(this.scenesDir, 'scene_blocks');
      return existsSync(sceneBlocksDir) ? sceneBlocksDir : this.scenesDir;
    }

    /**
     * 路径消毒（防逃逸）：把 LLM 提供的文件名 resolve 后断言其位于 scenesDir 内。
     * `../x.md`、绝对路径、嵌套目录越界等一律拒绝并抛错，绝不写出 scenesDir。
     */
  }, {
    key: "resolveScenePath",
    value: function resolveScenePath(fileName) {
      var full = join(this.scanDir(), fileName);
      var root = "".concat(resolve(this.scenesDir)).concat(sep);
      if (!resolve(full).startsWith(root)) {
        throw new Error("[scene-extractor] \u975E\u6CD5\u8DEF\u5F84\uFF08\u9003\u9038 scenesDir\uFF09: ".concat(fileName));
      }
      return full;
    }
  }]);
  return SceneExtractor;
}();

// ============================
// Helpers
// ============================

/** 动作归一：非法动作视为 update（工程侧保守默认）。 */
function normalizeAction(raw) {
  var a = String(raw !== null && raw !== void 0 ? raw : '').trim().toLowerCase();
  if (a === 'merge') return 'merge';
  if (a === 'create') return 'create';
  return 'update';
}

/**
 * 规范化场景内容：始终以 META 块为前缀（created/updated/summary/heat），
 * 再拼接正文。若 LLM 输出的 content 已含 META 块，则剥离后重新组装，
 * 保证 META 字段（尤其 created 保留、updated=当前时间、heat=工程侧计算值）正确。
 */
function normalizeContent(rawContent, created, updated, summary, heat) {
  var body = typeof rawContent === 'string' ? rawContent : '';
  if (body.trim() === '') body = '[空白场景]';

  // 剥掉 LLM 可能输出的 META 块（参考 parseSceneFile 的正则）
  var metaRe = /-----META-START-----\n[\s\S]*?\n-----META-END-----\n?\n?/;
  body = body.replace(metaRe, '').replace(/^\n+/, '');
  var scene = {
    path: '',
    meta: {
      created: created,
      updated: updated,
      summary: summary,
      heat: heat
    },
    body: body
  };
  return serializeSceneFile(scene);
}

/**
 * 把 LLM 输出的 JSON 响应解析为 SceneDecision。
 * 容错链（风格同 L1 parseExtractionResult）：
 * 剥代码块 → 括号平衡抽第一个 {...} → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 → 逐字段校验。
 */
export function parseSceneDecision(raw) {
  try {
    var cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    var objectJson = extractFirstJsonObject(cleaned);
    if (objectJson === null) {
      // 无合法 JSON 对象 → 抛错。L1 的失败语义是返回空结果（不写），
      // L2 没有"安全空动作"：回退成 update 会覆盖真实场景，因此直接 throw，
      // 由调用方决定降级（no-op / 跳过本批），绝不写任何文件。
      throw new Error('L2 LLM 输出中未找到合法 JSON 对象');
    }
    var sanitized = sanitizeJsonForParse(objectJson);
    var parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (_unused) {
      var repaired = repairSceneJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!parsed || _typeof(parsed) !== 'object' || Array.isArray(parsed)) {
      throw new Error('L2 LLM 输出 JSON 不是对象');
    }
    var d = parsed;
    return {
      action: typeof d.action === 'string' ? d.action : 'update',
      target_path: typeof d.target_path === 'string' ? d.target_path : undefined,
      content: typeof d.content === 'string' ? d.content : '',
      scene_name: typeof d.scene_name === 'string' ? d.scene_name : undefined,
      deleted_paths: Array.isArray(d.deleted_paths) ? d.deleted_paths.map(String) : [],
      request_persona_update: d.request_persona_update === true,
      summary: typeof d.summary === 'string' ? d.summary : '',
      heat: typeof d.heat === 'number' && Number.isFinite(d.heat) ? d.heat : undefined
    };
  } catch (err) {
    // 解析/校验失败 → 抛错（不是返回占位 action），调用方不落任何文件。
    throw err instanceof Error ? err : new Error("L2 \u573A\u666F\u51B3\u7B56\u89E3\u6790\u5931\u8D25: ".concat(String(err)));
  }
}

/** 抽取文本中第一个括号平衡的 JSON 对象字面量（正确处理字符串内的 { } 与嵌套对象）。 */
function extractFirstJsonObject(raw) {
  var start = raw.indexOf('{');
  if (start === -1) return null;
  var depth = 0;
  var inString = false;
  var escaped = false;
  for (var i = start; i < raw.length; i++) {
    var ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F），保留 \t \n \r。 */
function sanitizeJsonForParse(raw) {
  var out = '';
  var inString = false;
  for (var i = 0; i < raw.length; i++) {
    var ch = raw[i];
    if (inString) {
      if (ch === '\\') {
        var _raw;
        out += ch + ((_raw = raw[i + 1]) !== null && _raw !== void 0 ? _raw : '');
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      var code = ch.charCodeAt(0);
      if (code < 0x20) {
        switch (ch) {
          case '\n':
            out += '\\n';
            break;
          case '\r':
            out += '\\r';
            break;
          case '\t':
            out += '\\t';
            break;
          case '\b':
            out += '\\b';
            break;
          case '\f':
            out += '\\f';
            break;
          default:
            out += "\\u".concat(code.toString(16).padStart(4, '0'));
        }
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/** repair：去尾逗号（`,}` / `,]`）。 */
function repairSceneJson(json) {
  return json.replace(/,\s*([}\]])/g, '$1');
}