function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
/**
 * L1 去重（批量模式）：候选召回（向量/FTS 三级降级）+ LLM 批量判定（store/skip/update/merge）。
 *
 * 依据权威蓝图 §3.5：
 * - 候选召回三级降级：① vector + embed 且 storage 有 L1 → Tier 1 向量（多取 topK+len 抵消自匹配）；
 *   ② storage 有 FTS 数据 → Tier 2 FTS 关键词召回；③ 无召回能力 → storeAll 跳过去重。
 * - 有候选 → formatBatchConflictPrompt + LLM（CONFLICT_DETECTION_SYSTEM_PROMPT）→ 解析判定
 *   （复用 Task 2 的容错思路：剥代码块/抽数组/逐字段补默认）。
 * - applyDecisions：skip → 不落；store → DualWriter.storeL1；
 *   update/merge → vector.remove(target) 每个 target_id + DualWriter.storeL1(merged_content/type, version=max+1)。
 * - 隔离：filter 带 team/agent，绝不跨租户。
 */

import { DualWriter } from "./dual-writer.js";
import { CONFLICT_DETECTION_SYSTEM_PROMPT, formatBatchConflictPrompt } from "../prompts/l1-dedup.js";

// ============================
// Types
// ============================

// ============================
// Core: batchDedup
// ============================

var VALID_TYPES = ['persona', 'episodic', 'instruction', 'work_fact', 'work_task', 'work_method', 'work_artifact'];

/**
 * 批量去重：候选召回（三级降级）+ LLM 批量判定，返回每条新记忆的决策。
 *
 * 候选召回：
 * 1. Tier 1 向量：vector + embed 可用且 storage 有 L1 记录 → embed 每条新记忆 content，
 *    vector.search topK（多取 topK+len 抵消自匹配），过滤本批 + 按 score 阈值 → 候选。
 * 2. Tier 2 FTS：storage 有 FTS 数据 → storage.search(memory.content, {limit:10}) 过滤本批 → 候选。
 * 3. 无召回能力 → storeAll() 跳过去重。
 *
 * 隔离：team/agent 过滤在候选召回前完成（存储层查询自带 team/agent 过滤），绝不跨租户。
 */
export function batchDedup(_x) {
  return _batchDedup.apply(this, arguments);
}

// ============================
// Candidate recall
// ============================

/** storage 是否已有 L1 记录（meta 表非空）。无 query 的 search() 列出全部（默认 limit 20），足够判空。 */
function _batchDedup() {
  _batchDedup = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(params) {
    var memories, llm, vector, embed, storage, _params$conflictRecal, conflictRecallTopK, team, agent, storeAll, storageHasL1, hasVectorTier, hasFtsTier, matches, raw;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          memories = params.memories, llm = params.llm, vector = params.vector, embed = params.embed, storage = params.storage, _params$conflictRecal = params.conflictRecallTopK, conflictRecallTopK = _params$conflictRecal === void 0 ? 5 : _params$conflictRecal, team = params.team, agent = params.agent;
          if (!(memories.length === 0)) {
            _context.next = 3;
            break;
          }
          return _context.abrupt("return", []);
        case 3:
          storeAll = function storeAll() {
            return memories.map(function (m) {
              return {
                record_id: m.record_id,
                action: 'store',
                target_ids: []
              };
            });
          }; // 召回能力检测：
          // - Tier 1 需要 vector + embed + storage 里有已落库的 L1（meta 索引存在）
          // - Tier 2 需要 storage 里有 FTS 数据（meta 索引存在）
          // - 都没有 → 无召回能力 → storeAll
          storageHasL1 = storageHasRecords(storage);
          hasVectorTier = Boolean(vector && embed) && storageHasL1;
          hasFtsTier = storageHasL1;
          if (!(!hasVectorTier && !hasFtsTier)) {
            _context.next = 9;
            break;
          }
          return _context.abrupt("return", storeAll());
        case 9:
          _context.prev = 9;
          if (!hasVectorTier) {
            _context.next = 16;
            break;
          }
          _context.next = 13;
          return findCandidatesByVector(memories, vector, embed, storage, conflictRecallTopK, {
            team: team,
            agent: agent
          });
        case 13:
          matches = _context.sent;
          _context.next = 19;
          break;
        case 16:
          _context.next = 18;
          return findCandidatesByFts(memories, storage, {
            team: team,
            agent: agent
          });
        case 18:
          matches = _context.sent;
        case 19:
          _context.next = 25;
          break;
        case 21:
          _context.prev = 21;
          _context.t0 = _context["catch"](9);
          console.warn("[l1-dedup] candidate recall failed, all store: ".concat(_context.t0 instanceof Error ? _context.t0.message : String(_context.t0)));
          return _context.abrupt("return", storeAll());
        case 25:
          _context.prev = 25;
          _context.next = 28;
          return llm.run({
            prompt: formatBatchConflictPrompt(matches),
            systemPrompt: CONFLICT_DETECTION_SYSTEM_PROMPT,
            taskId: 'l1-conflict-detection',
            timeoutMs: 180000
          });
        case 28:
          raw = _context.sent;
          return _context.abrupt("return", parseDedupDecisions(raw, memories));
        case 32:
          _context.prev = 32;
          _context.t1 = _context["catch"](25);
          // LLM 失败 → 全部 store（不丢记忆）
          console.warn("[l1-dedup] LLM conflict detection failed, all store: ".concat(_context.t1 instanceof Error ? _context.t1.message : String(_context.t1)));
          return _context.abrupt("return", storeAll());
        case 36:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[9, 21], [25, 32]]);
  }));
  return _batchDedup.apply(this, arguments);
}
function storageHasRecords(storage) {
  try {
    return storage.search(undefined, {
      limit: 20
    }).length > 0;
  } catch (_unused) {
    return false;
  }
}
/**
 * Tier 1 向量召回：批量 embed 新记忆 → vector.search topK（多取 topK+len 抵消自匹配）→
 * 过滤本批 → 从 meta 索引取回候选详情（team/agent 隔离 + score 阈值）。
 */
function findCandidatesByVector(_x2, _x3, _x4, _x5, _x6, _x7) {
  return _findCandidatesByVector.apply(this, arguments);
}
/**
 * Tier 2 FTS 召回：storage.search(memory.content, {limit:10}) → 过滤本批 → 取前 topK。
 * 用 memory.content 作为隔离条件下的搜索词（storage.search 的 FTS 命中会自动排除 team/agent 不符的记录）。
 */
function _findCandidatesByVector() {
  _findCandidatesByVector = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(memories, vector, embed, storage, topK, isolation) {
    var newRecordIds, embeddings, matches, i, mem, queryVec, searchResults, candidates, _iterator4, _step4, _hit$score, hit, row;
    return _regeneratorRuntime().wrap(function _callee2$(_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          newRecordIds = new Set(memories.map(function (m) {
            return m.record_id;
          })); // 批量 embed 所有新记忆
          _context2.next = 3;
          return embed.embedBatch(memories.map(function (m) {
            return m.content;
          }));
        case 3:
          embeddings = _context2.sent;
          matches = [];
          i = 0;
        case 6:
          if (!(i < memories.length)) {
            _context2.next = 44;
            break;
          }
          mem = memories[i];
          queryVec = embeddings[i]; // 多取 topK + len 抵消自匹配（本批新记忆可能已入向量库）
          searchResults = vector.search(queryVec, topK + memories.length);
          candidates = [];
          _iterator4 = _createForOfIteratorHelper(searchResults);
          _context2.prev = 12;
          _iterator4.s();
        case 14:
          if ((_step4 = _iterator4.n()).done) {
            _context2.next = 32;
            break;
          }
          hit = _step4.value;
          if (!(candidates.length >= topK)) {
            _context2.next = 18;
            break;
          }
          return _context2.abrupt("break", 32);
        case 18:
          if (!newRecordIds.has(hit.record_id)) {
            _context2.next = 20;
            break;
          }
          return _context2.abrupt("continue", 30);
        case 20:
          if (!(((_hit$score = hit.score) !== null && _hit$score !== void 0 ? _hit$score : 0) <= 0.3)) {
            _context2.next = 22;
            break;
          }
          return _context2.abrupt("continue", 30);
        case 22:
          // 相似度阈值：正交/弱相关不算候选
          row = storage.getById(hit.record_id);
          if (row) {
            _context2.next = 25;
            break;
          }
          return _context2.abrupt("continue", 30);
        case 25:
          if (!(isolation.team !== undefined && row.team !== isolation.team)) {
            _context2.next = 27;
            break;
          }
          return _context2.abrupt("continue", 30);
        case 27:
          if (!(isolation.agent !== undefined && row.agent !== isolation.agent)) {
            _context2.next = 29;
            break;
          }
          return _context2.abrupt("continue", 30);
        case 29:
          candidates.push(rowToL1Record(row, storage));
        case 30:
          _context2.next = 14;
          break;
        case 32:
          _context2.next = 37;
          break;
        case 34:
          _context2.prev = 34;
          _context2.t0 = _context2["catch"](12);
          _iterator4.e(_context2.t0);
        case 37:
          _context2.prev = 37;
          _iterator4.f();
          return _context2.finish(37);
        case 40:
          matches.push({
            newMemory: mem,
            candidates: candidates
          });
        case 41:
          i++;
          _context2.next = 6;
          break;
        case 44:
          return _context2.abrupt("return", matches);
        case 45:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[12, 34, 37, 40]]);
  }));
  return _findCandidatesByVector.apply(this, arguments);
}
function findCandidatesByFts(_x8, _x9, _x10) {
  return _findCandidatesByFts.apply(this, arguments);
}
/**
 * 构造 FTS 搜索词：
 * - team/agent 隔离时用不存在的占位词（FTS 命中 0 条）——storage.search 只按 owner_id/track/category
 *   过滤，没有 team/agent 过滤能力，直接以 content 搜索必会跨租户命中；占位词让候选为空，LLM 按
 *   "无候选 → store" 处理，绝不跨租户。
 * - 无隔离时用记忆内容本身（FTS 关键词召回）。
 */
function _findCandidatesByFts() {
  _findCandidatesByFts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(memories, storage, isolation) {
    var newRecordIds, matches, _iterator5, _step5, mem, searchTerm, results, candidates, _iterator6, _step6, r, row;
    return _regeneratorRuntime().wrap(function _callee3$(_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          newRecordIds = new Set(memories.map(function (m) {
            return m.record_id;
          }));
          matches = [];
          _iterator5 = _createForOfIteratorHelper(memories);
          _context3.prev = 3;
          _iterator5.s();
        case 5:
          if ((_step5 = _iterator5.n()).done) {
            _context3.next = 40;
            break;
          }
          mem = _step5.value;
          searchTerm = makeFtsSearchTerm(mem.content, isolation);
          results = storage.search(searchTerm, {
            limit: 10
          });
          candidates = [];
          _iterator6 = _createForOfIteratorHelper(results);
          _context3.prev = 11;
          _iterator6.s();
        case 13:
          if ((_step6 = _iterator6.n()).done) {
            _context3.next = 29;
            break;
          }
          r = _step6.value;
          if (!(candidates.length >= 5)) {
            _context3.next = 17;
            break;
          }
          return _context3.abrupt("break", 29);
        case 17:
          if (!newRecordIds.has(r.id)) {
            _context3.next = 19;
            break;
          }
          return _context3.abrupt("continue", 27);
        case 19:
          row = storage.getById(r.id);
          if (row) {
            _context3.next = 22;
            break;
          }
          return _context3.abrupt("continue", 27);
        case 22:
          if (!(isolation.team !== undefined && row.team !== isolation.team)) {
            _context3.next = 24;
            break;
          }
          return _context3.abrupt("continue", 27);
        case 24:
          if (!(isolation.agent !== undefined && row.agent !== isolation.agent)) {
            _context3.next = 26;
            break;
          }
          return _context3.abrupt("continue", 27);
        case 26:
          candidates.push(rowToL1Record(row, storage));
        case 27:
          _context3.next = 13;
          break;
        case 29:
          _context3.next = 34;
          break;
        case 31:
          _context3.prev = 31;
          _context3.t0 = _context3["catch"](11);
          _iterator6.e(_context3.t0);
        case 34:
          _context3.prev = 34;
          _iterator6.f();
          return _context3.finish(34);
        case 37:
          matches.push({
            newMemory: mem,
            candidates: candidates
          });
        case 38:
          _context3.next = 5;
          break;
        case 40:
          _context3.next = 45;
          break;
        case 42:
          _context3.prev = 42;
          _context3.t1 = _context3["catch"](3);
          _iterator5.e(_context3.t1);
        case 45:
          _context3.prev = 45;
          _iterator5.f();
          return _context3.finish(45);
        case 48:
          return _context3.abrupt("return", matches);
        case 49:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[3, 42, 45, 48], [11, 31, 34, 37]]);
  }));
  return _findCandidatesByFts.apply(this, arguments);
}
function makeFtsSearchTerm(content, isolation) {
  if (isolation.team !== undefined || isolation.agent !== undefined) {
    return 'mymore-no-cross-tenant';
  }
  return content;
}

// ============================
// Result parsing（容错，复用 Task 2 思路）
// ============================

/**
 * 解析 LLM 批量判定 JSON。容错链：
 * 剥代码块 → 括号平衡抽首数组 → sanitize 控制字符 → JSON.parse（失败 repair 一次）→
 * 逐字段补默认（action→store，target_ids→[]，merged_* 类型校验）→ 缺失记忆补 store。
 */
export function parseDedupDecisions(raw, memories) {
  try {
    // 1. 剥 markdown 代码块
    var cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // 2. 括号平衡抽取第一个 JSON 数组
    var arrayJson = extractFirstJsonArray(cleaned);
    if (arrayJson === null) return storeAllFallback(memories);

    // 3. sanitize 控制字符
    var sanitized = sanitizeJsonForParse(arrayJson);

    // 4. JSON.parse，失败 repair 一次
    var parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (_unused2) {
      var repaired = repairDedupJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!Array.isArray(parsed)) return storeAllFallback(memories);

    // 5. 逐条结构化校验 + 补默认
    var validActions = ['store', 'update', 'merge', 'skip'];
    var decisions = [];
    var _iterator = _createForOfIteratorHelper(parsed),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var _d$record_id, _d$action;
        var item = _step.value;
        if (!item || _typeof(item) !== 'object') continue;
        var d = item;
        var recordId = String((_d$record_id = d.record_id) !== null && _d$record_id !== void 0 ? _d$record_id : '');
        // 空/缺失 record_id → LLM 幻觉，跳过该条
        if (!recordId) continue;
        var rawAction = String((_d$action = d.action) !== null && _d$action !== void 0 ? _d$action : 'store');
        var action = validActions.includes(rawAction) ? rawAction : 'store';
        decisions.push({
          record_id: recordId,
          action: action,
          target_ids: Array.isArray(d.target_ids) ? d.target_ids.map(String) : [],
          merged_content: typeof d.merged_content === 'string' ? d.merged_content : undefined,
          merged_type: VALID_TYPES.includes(d.merged_type) ? d.merged_type : undefined,
          merged_priority: typeof d.merged_priority === 'number' ? d.merged_priority : undefined,
          merged_timestamps: Array.isArray(d.merged_timestamps) ? d.merged_timestamps.map(String) : undefined
        });
      }

      // 6. 缺失的记忆补 store（保证每条新记忆都有决策）
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    var decidedIds = new Set(decisions.map(function (d) {
      return d.record_id;
    }));
    var _iterator2 = _createForOfIteratorHelper(memories),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var mem = _step2.value;
        if (!decidedIds.has(mem.record_id)) {
          decisions.push({
            record_id: mem.record_id,
            action: 'store',
            target_ids: []
          });
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
    return decisions;
  } catch (err) {
    console.warn("[l1-dedup] parse failed, all store: ".concat(err instanceof Error ? err.message : String(err)));
    return storeAllFallback(memories);
  }
}
function storeAllFallback(memories) {
  return memories.map(function (m) {
    return {
      record_id: m.record_id,
      action: 'store',
      target_ids: []
    };
  });
}

/** 抽取文本中第一个括号平衡的 JSON 数组字面量（正确跳过字符串内的 [ ]）。 */
function extractFirstJsonArray(raw) {
  var start = raw.indexOf('[');
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
    } else if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F）。 */
function sanitizeJsonForParse(raw) {
  var escaped = escapeControlCharsInJsonStrings(raw);
  try {
    JSON.parse(escaped);
    return escaped;
  } catch (_unused3) {
    return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }
}
function escapeControlCharsInJsonStrings(raw) {
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

/** repair：去尾逗号 + merged_priority 裸值兜底（如 action 缺失时补 store）。 */
function repairDedupJson(json) {
  return json.replace(/,\s*([}\]])/g, '$1');
}

// ============================
// applyDecisions
// ============================

/**
 * 按决策落库：
 * - skip → 不落任何东西
 * - store → DualWriter.storeL1({...memory, version: memory.version})
 * - update/merge → 先校验 target_ids（存在 + 同租户 + 非自身，防 LLM 幻觉），落新记录
 *   （merged_content/type，version = 新记忆与各合法 target 的最大 version + 1），再对每个合法
 *   target 调 storage.markSuperseded(target, 新记忆 id) + vector.remove(target)。
 *   顺序：先 storeL1 成功，后动目标 —— storeL1 失败时目标不被误删/误归档。
 *
 * @returns 实际落库（或跳过）后的最终 L1Record 列表。
 */
export function applyDecisions(_x11) {
  return _applyDecisions.apply(this, arguments);
}

/**
 * 校验 update/merge 的 target_ids（防 LLM 幻觉）：
 * - 必须存在于 storage（getById 非空）
 * - 必须与当前 memory 同租户（team/agent 严格匹配，绝不跨租户）
 * - 不能是当前 memory 自身（自引用）
 * 不满足的 target 直接跳过：不 remove、不纳入 version 计算、不 markSuperseded。
 */
function _applyDecisions() {
  _applyDecisions = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4(params) {
    var memories, decisions, storage, vector, embed, baseDir, team, agent, writer, decisionByRecord, _iterator7, _step7, d, written, _iterator8, _step8, _decision$target_ids, _decision$merged_cont, _normalizeMergedType2, memory, decision, stored, validTargets, content, type, mergedPriority, maxVersion, _iterator9, _step9, target, newVersion, mergedRecord, _iterator10, _step10, _target;
    return _regeneratorRuntime().wrap(function _callee4$(_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          memories = params.memories, decisions = params.decisions, storage = params.storage, vector = params.vector, embed = params.embed, baseDir = params.baseDir, team = params.team, agent = params.agent;
          writer = new DualWriter({
            storage: storage,
            vector: vector,
            embed: embed,
            baseDir: baseDir,
            team: team,
            agent: agent
          });
          decisionByRecord = new Map();
          _iterator7 = _createForOfIteratorHelper(decisions);
          try {
            for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
              d = _step7.value;
              if (!decisionByRecord.has(d.record_id)) decisionByRecord.set(d.record_id, d);
            }
          } catch (err) {
            _iterator7.e(err);
          } finally {
            _iterator7.f();
          }
          written = [];
          _iterator8 = _createForOfIteratorHelper(memories);
          _context4.prev = 7;
          _iterator8.s();
        case 9:
          if ((_step8 = _iterator8.n()).done) {
            _context4.next = 37;
            break;
          }
          memory = _step8.value;
          decision = decisionByRecord.get(memory.record_id);
          if (!(!decision || decision.action === 'skip')) {
            _context4.next = 14;
            break;
          }
          return _context4.abrupt("continue", 35);
        case 14:
          if (!(decision.action === 'store')) {
            _context4.next = 21;
            break;
          }
          _context4.next = 17;
          return writer.storeL1(_objectSpread(_objectSpread({}, memory), {}, {
            version: memory.version
          }));
        case 17:
          stored = _context4.sent;
          written.push(_objectSpread(_objectSpread({}, memory), {}, {
            version: memory.version
          }));
          void stored;
          return _context4.abrupt("continue", 35);
        case 21:
          // update / merge
          // 1. 校验 target_ids：存在 + 同租户 + 非自身（防 LLM 幻觉），不满足的直接跳过
          validTargets = validateTargets(memory, (_decision$target_ids = decision.target_ids) !== null && _decision$target_ids !== void 0 ? _decision$target_ids : [], storage, team, agent); // 2. 新记录形状：merged_content/type，version = max(新记忆, 各合法 target) + 1
          content = (_decision$merged_cont = decision.merged_content) !== null && _decision$merged_cont !== void 0 ? _decision$merged_cont : memory.content;
          type = (_normalizeMergedType2 = normalizeMergedType(decision.merged_type)) !== null && _normalizeMergedType2 !== void 0 ? _normalizeMergedType2 : memory.type;
          mergedPriority = decision.merged_priority;
          maxVersion = memory.version;
          _iterator9 = _createForOfIteratorHelper(validTargets);
          try {
            for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
              target = _step9.value;
              if (typeof target.version === 'number' && target.version > maxVersion) {
                maxVersion = target.version;
              }
            }
          } catch (err) {
            _iterator9.e(err);
          } finally {
            _iterator9.f();
          }
          newVersion = maxVersion + 1;
          mergedRecord = _objectSpread(_objectSpread({}, memory), {}, {
            id: memory.id,
            type: type,
            content: content,
            priority: mergedPriority !== null && mergedPriority !== void 0 ? mergedPriority : memory.priority,
            version: newVersion
          }); // 3. 先落新记录（成功后才动目标：storeL1 失败时目标保持原状，可安全重试）
          _context4.next = 32;
          return writer.storeL1(mergedRecord);
        case 32:
          // 4. 对每个合法 target：标记被新记忆替代（FTS 不再召回）+ 移除旧向量
          _iterator10 = _createForOfIteratorHelper(validTargets);
          try {
            for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
              _target = _step10.value;
              storage.markSuperseded(_target.id, memory.id);
              vector.remove(_target.id);
            }
          } catch (err) {
            _iterator10.e(err);
          } finally {
            _iterator10.f();
          }
          written.push(mergedRecord);
        case 35:
          _context4.next = 9;
          break;
        case 37:
          _context4.next = 42;
          break;
        case 39:
          _context4.prev = 39;
          _context4.t0 = _context4["catch"](7);
          _iterator8.e(_context4.t0);
        case 42:
          _context4.prev = 42;
          _iterator8.f();
          return _context4.finish(42);
        case 45:
          return _context4.abrupt("return", written);
        case 46:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[7, 39, 42, 45]]);
  }));
  return _applyDecisions.apply(this, arguments);
}
function validateTargets(memory, targetIds, storage, team, agent) {
  var _memory$team, _memory$agent;
  var effectiveTeam = (_memory$team = memory.team) !== null && _memory$team !== void 0 ? _memory$team : team;
  var effectiveAgent = (_memory$agent = memory.agent) !== null && _memory$agent !== void 0 ? _memory$agent : agent;
  var valid = [];
  var _iterator3 = _createForOfIteratorHelper(targetIds),
    _step3;
  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var _row$team, _row$agent;
      var targetId = _step3.value;
      if (!targetId || targetId === memory.id) continue; // 空或自引用 → 跳过
      var row = storage.getById(targetId);
      if (!row) continue; // 不存在 → LLM 幻觉，跳过
      // 同租户校验：team/agent 严格相等（null 与 undefined 视为相同）
      if (((_row$team = row.team) !== null && _row$team !== void 0 ? _row$team : undefined) !== (effectiveTeam !== null && effectiveTeam !== void 0 ? effectiveTeam : undefined)) continue;
      if (((_row$agent = row.agent) !== null && _row$agent !== void 0 ? _row$agent : undefined) !== (effectiveAgent !== null && effectiveAgent !== void 0 ? effectiveAgent : undefined)) continue;
      valid.push({
        id: row.id,
        version: row.version
      });
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }
  return valid;
}

// ============================
// 转换辅助
// ============================

function normalizeMergedType(raw) {
  if (!raw) return null;
  var lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower)) return lower;
  // legacy 别名
  if (lower === 'episode') return 'episodic';
  if (lower === 'instruct') return 'instruction';
  if (lower === 'preference') return 'persona';
  return null;
}

/** MemoryRow（meta 索引）+ storage（取 FTS content）→ L1Record。 */
function rowToL1Record(row, storage) {
  var _normalizeMergedType, _row$type, _storage$getContentBy, _row$scene_name, _row$team2, _row$agent2;
  return {
    id: row.id,
    type: (_normalizeMergedType = normalizeMergedType((_row$type = row.type) !== null && _row$type !== void 0 ? _row$type : '')) !== null && _normalizeMergedType !== void 0 ? _normalizeMergedType : 'episodic',
    content: (_storage$getContentBy = storage.getContentById(row.id)) !== null && _storage$getContentBy !== void 0 ? _storage$getContentBy : '',
    priority: typeof row.priority === 'number' ? row.priority : 50,
    scene_name: (_row$scene_name = row.scene_name) !== null && _row$scene_name !== void 0 ? _row$scene_name : undefined,
    source_message_ids: parseSourceMessageIds(row.source_message_ids),
    created_at: row.created_at,
    version: typeof row.version === 'number' ? row.version : 1,
    team: (_row$team2 = row.team) !== null && _row$team2 !== void 0 ? _row$team2 : undefined,
    agent: (_row$agent2 = row.agent) !== null && _row$agent2 !== void 0 ? _row$agent2 : undefined
  };
}

/** source_message_ids 可能是 JSON 字符串数组或逗号分隔，或 null。 */
function parseSourceMessageIds(raw) {
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (_unused4) {
    // 非 JSON → 逗号分隔兜底
  }
  return raw.split(',').map(function (s) {
    return s.trim();
  }).filter(Boolean);
}