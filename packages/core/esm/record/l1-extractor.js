function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
/**
 * L1 Memory Extractor：单次 LLM 调用做「情境切分 + 记忆提取 + JSON 输出」，
 * 带严格的解析容错（LLM 输出永远不可信）。
 *
 * 管线：
 * 1. 把 messages 切分为 newMessages（后 maxMessagesPerExtraction=10 条）+ backgroundMessages（紧邻前最多 5 条，仅作上下文）
 * 2. 单次 LLM 调用提取情境切分后的记忆（taskId='l1-extraction', timeoutMs=180_000）
 * 3. parseExtractionResult：剥代码块 → 抽第一个 [...] → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 → 逐字段补默认 → normalizeType
 * 4. 截断（maxMemoriesPerSession=10）→ 构建 L1Record → appendL1Record 落盘（真源）→ 返回结果
 *
 * 失败处理：LLM 抛错 → success:false 全 0；单条写失败 warn 跳过不中断批次。
 */

import { EXTRACT_MEMORIES_SYSTEM_PROMPT, formatExtractionPrompt } from "../prompts/l1-extraction.js";
import { appendL1Record, generateMemoryId } from "./l1-writer.js";

// ============================
// Types
// ============================

// ============================
// Core function
// ============================

/**
 * 运行完整 L1 提取管线。
 */
export function extractL1Memories(_x) {
  return _extractL1Memories.apply(this, arguments);
}

// ============================
// LLM call
// ============================
function _extractL1Memories() {
  _extractL1Memories = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(params) {
    var messages, llm, baseDir, sessionKey, _params$maxMessagesPe, maxMessagesPerExtraction, _params$maxBackground, maxBackgroundMessages, _params$maxMemoriesPe, maxMemoriesPerSession, previousSceneName, newMessages, bgEndIdx, backgroundMessages, scenes, sceneNames, extracted, _iterator2, _step2, scene, _iterator3, _step3, _mem, memType, records, _i, _extracted, _mem$metadata, mem, record;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          messages = params.messages, llm = params.llm, baseDir = params.baseDir, sessionKey = params.sessionKey, _params$maxMessagesPe = params.maxMessagesPerExtraction, maxMessagesPerExtraction = _params$maxMessagesPe === void 0 ? 10 : _params$maxMessagesPe, _params$maxBackground = params.maxBackgroundMessages, maxBackgroundMessages = _params$maxBackground === void 0 ? 5 : _params$maxBackground, _params$maxMemoriesPe = params.maxMemoriesPerSession, maxMemoriesPerSession = _params$maxMemoriesPe === void 0 ? 10 : _params$maxMemoriesPe, previousSceneName = params.previousSceneName;
          if (!(messages.length === 0)) {
            _context.next = 3;
            break;
          }
          return _context.abrupt("return", {
            success: true,
            extractedCount: 0,
            storedCount: 0,
            records: [],
            sceneNames: []
          });
        case 3:
          // 切分：newMessages 取最后 N 条；backgroundMessages 取紧邻前最多 M 条（仅上下文，严禁提取）
          newMessages = messages.slice(-maxMessagesPerExtraction);
          bgEndIdx = messages.length - newMessages.length;
          backgroundMessages = bgEndIdx > 0 ? messages.slice(Math.max(0, bgEndIdx - maxBackgroundMessages), bgEndIdx) : []; // Step 1: LLM 提取（情境切分 + 记忆提取）
          _context.prev = 6;
          _context.next = 9;
          return callLlmExtraction({
            newMessages: newMessages,
            backgroundMessages: backgroundMessages,
            previousSceneName: previousSceneName,
            llm: llm
          });
        case 9:
          scenes = _context.sent;
          _context.next = 15;
          break;
        case 12:
          _context.prev = 12;
          _context.t0 = _context["catch"](6);
          return _context.abrupt("return", {
            success: false,
            extractedCount: 0,
            storedCount: 0,
            records: [],
            sceneNames: []
          });
        case 15:
          // Step 2: 展平所有场景的记忆，逐条 normalizeType + 补默认值
          sceneNames = [];
          extracted = [];
          _iterator2 = _createForOfIteratorHelper(scenes);
          _context.prev = 18;
          _iterator2.s();
        case 20:
          if ((_step2 = _iterator2.n()).done) {
            _context.next = 44;
            break;
          }
          scene = _step2.value;
          sceneNames.push(scene.scene_name);
          _iterator3 = _createForOfIteratorHelper(scene.memories);
          _context.prev = 24;
          _iterator3.s();
        case 26:
          if ((_step3 = _iterator3.n()).done) {
            _context.next = 34;
            break;
          }
          _mem = _step3.value;
          memType = normalizeType(_mem.type);
          if (memType) {
            _context.next = 31;
            break;
          }
          return _context.abrupt("continue", 32);
        case 31:
          // 非法 type 跳过
          extracted.push({
            content: _mem.content,
            type: memType,
            priority: typeof _mem.priority === 'number' ? _mem.priority : 50,
            source_message_ids: Array.isArray(_mem.source_message_ids) ? _mem.source_message_ids.map(String) : [],
            metadata: _mem.metadata && _typeof(_mem.metadata) === 'object' ? _mem.metadata : {},
            scene_name: scene.scene_name
          });
        case 32:
          _context.next = 26;
          break;
        case 34:
          _context.next = 39;
          break;
        case 36:
          _context.prev = 36;
          _context.t1 = _context["catch"](24);
          _iterator3.e(_context.t1);
        case 39:
          _context.prev = 39;
          _iterator3.f();
          return _context.finish(39);
        case 42:
          _context.next = 20;
          break;
        case 44:
          _context.next = 49;
          break;
        case 46:
          _context.prev = 46;
          _context.t2 = _context["catch"](18);
          _iterator2.e(_context.t2);
        case 49:
          _context.prev = 49;
          _iterator2.f();
          return _context.finish(49);
        case 52:
          // maxMemoriesPerSession 截断
          if (extracted.length > maxMemoriesPerSession) {
            extracted.length = maxMemoriesPerSession;
          }

          // Step 3: 构建 L1Record 并落盘
          records = [];
          for (_i = 0, _extracted = extracted; _i < _extracted.length; _i++) {
            mem = _extracted[_i];
            record = {
              id: generateMemoryId(),
              type: mem.type,
              content: mem.content,
              priority: mem.priority,
              scene_name: mem.scene_name,
              source_message_ids: mem.source_message_ids,
              created_at: new Date().toISOString(),
              version: 1,
              metadata: (_mem$metadata = mem.metadata) !== null && _mem$metadata !== void 0 ? _mem$metadata : {}
            };
            try {
              appendL1Record(record, baseDir);
              records.push(record);
            } catch (err) {
              // 单条写失败 warn 跳过，不中断批次
              console.warn("[l1-extractor] write failed for memory \"".concat(record.content.slice(0, 50), "...\": ").concat(err instanceof Error ? err.message : String(err)));
            }
          }
          return _context.abrupt("return", {
            success: true,
            extractedCount: extracted.length,
            storedCount: records.length,
            records: records,
            sceneNames: sceneNames,
            lastSceneName: sceneNames.length > 0 ? sceneNames[sceneNames.length - 1] : undefined
          });
        case 56:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[6, 12], [18, 46, 49, 52], [24, 36, 39, 42]]);
  }));
  return _extractL1Memories.apply(this, arguments);
}
function callLlmExtraction(_x2) {
  return _callLlmExtraction.apply(this, arguments);
} // ============================
// Parse tolerance（§3.4）
// ============================
/**
 * 把 LLM 输出的 JSON 响应解析为 SceneSegment[]。
 * 容错链：剥代码块 → 正则抽第一个 [...] → sanitize 控制字符 → JSON.parse 失败 repair 重试一次 →
 * 逐字段补默认（scene_name→"未知情境"，type→"episodic"，priority→50，source_message_ids→[]，metadata→{}）。
 */
function _callLlmExtraction() {
  _callLlmExtraction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(params) {
    var newMessages, backgroundMessages, previousSceneName, llm, systemPrompt, prompt, raw;
    return _regeneratorRuntime().wrap(function _callee2$(_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          newMessages = params.newMessages, backgroundMessages = params.backgroundMessages, previousSceneName = params.previousSceneName, llm = params.llm;
          systemPrompt = EXTRACT_MEMORIES_SYSTEM_PROMPT;
          prompt = formatExtractionPrompt({
            newMessages: newMessages,
            backgroundMessages: backgroundMessages,
            previousSceneName: previousSceneName
          });
          _context2.next = 5;
          return llm.run({
            prompt: prompt,
            systemPrompt: systemPrompt,
            taskId: 'l1-extraction',
            timeoutMs: 180000
          });
        case 5:
          raw = _context2.sent;
          return _context2.abrupt("return", parseExtractionResult(raw));
        case 7:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return _callLlmExtraction.apply(this, arguments);
}
export function parseExtractionResult(raw) {
  try {
    // 1. 剥 markdown 代码块
    var cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // 2. 抽取第一个 JSON 数组：括号平衡扫描（正确跳过字符串字面量内的
    //    [ ] 与嵌套数组，杜绝贪心正则被尾部含 [ ] 的文本污染整个 batch）
    var arrayJson = extractFirstJsonArray(cleaned);
    if (arrayJson === null) return [];

    // 3. sanitize 控制字符
    var sanitized = sanitizeJsonForParse(arrayJson);

    // 4. JSON.parse，失败则 repair 重试一次
    var parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (_unused) {
      var repaired = repairExtractionJson(sanitized);
      parsed = JSON.parse(repaired);
    }
    if (!Array.isArray(parsed)) return [];

    // 5. 逐 scene 结构化校验 + 补默认值（不全量丢弃）
    var scenes = [];
    var _iterator = _createForOfIteratorHelper(parsed),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var item = _step.value;
        if (!item || _typeof(item) !== 'object') continue;
        var s = item;
        scenes.push({
          scene_name: typeof s.scene_name === 'string' ? s.scene_name : '未知情境',
          message_ids: Array.isArray(s.message_ids) ? s.message_ids.map(String) : [],
          memories: Array.isArray(s.memories) ? s.memories.filter(function (m) {
            return m && _typeof(m) === 'object' && typeof m.content === 'string' && m.content.length > 0;
          }).map(function (m) {
            var _m$type;
            return {
              content: String(m.content),
              type: String((_m$type = m.type) !== null && _m$type !== void 0 ? _m$type : 'episodic'),
              priority: typeof m.priority === 'number' ? m.priority : 50,
              source_message_ids: Array.isArray(m.source_message_ids) ? m.source_message_ids.map(String) : [],
              metadata: m.metadata && _typeof(m.metadata) === 'object' ? m.metadata : {}
            };
          }) : []
        });
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return scenes;
  } catch (_unused2) {
    return [];
  }
}

/**
 * 抽取文本中第一个括号平衡的 JSON 数组字面量。
 * 逐字符扫描，跟踪字符串状态（转义、引号）与 `[]` 嵌套深度：
 * - 字符串字面量内的 `[` / `]` 不算结构符号；
 * - 返回从首个 `[` 到其匹配的 `]` 的切片；
 * - 找不到或未闭合返回 null（调用方按空结果处理）。
 */
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

/**
 * 清洗 JSON 字符串字面量内的控制字符（U+0000–U+001F）。
 * 先尝试完整转义并验证解析；仍失败则暴力剥离无文本含义的控制字符（保留 \t \n \r）。
 */
function sanitizeJsonForParse(raw) {
  var escaped = escapeControlCharsInJsonStrings(raw);
  try {
    JSON.parse(escaped);
    return escaped;
  } catch (_unused3) {
    return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }
}

/** 逐字符遍历 JSON 文本，把字符串字面量内的控制字符转为短转义或 \uXXXX。 */
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

/**
 * repair 裸标识符优先级 + 去尾逗号：
 * - `"priority": sheet`（裸标识符）→ `"priority": 50`
 * - 数组/对象尾逗号 `,}` / `,]` → 去除
 */
function repairExtractionJson(json) {
  return json.replace(/("priority"\s*:\s*)(?!-?\d+(?:\.\d+)?\s*[,}]|"[^"\\]*(?:\\.[^"\\]*)*"\s*[,}])([\s\S]*?)(?=,\s*"(?:content|type|priority|source_message_ids|metadata)"\s*:|[}\]])/g, function (_m, prefix) {
    return "".concat(prefix, "50");
  }).replace(/,\s*([}\]])/g, '$1');
}

// ============================
// Type normalization
// ============================

var VALID_TYPES = ['persona', 'episodic', 'instruction', 'work_fact', 'work_task', 'work_method', 'work_artifact'];

/**
 * 类型归一化：7 种合法类型 + legacy 别名映射（episode→episodic, instruct→instruction,
 * preference→persona）；非法返回 null（调用方跳过该条）。
 */
function normalizeType(raw) {
  var lower = raw.toLowerCase().trim();
  if (VALID_TYPES.includes(lower)) {
    return lower;
  }
  if (lower === 'episode') return 'episodic';
  if (lower === 'instruct') return 'instruction';
  if (lower === 'preference') return 'persona';
  return null;
}