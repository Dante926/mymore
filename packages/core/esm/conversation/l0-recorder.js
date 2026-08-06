function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
import { mkdirSync, appendFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
function dateStr() {
  var d = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Date();
  return d.toISOString().slice(0, 10);
}

/** 从单条消息中提取纯文本 content：支持 string 或 {type:'text',text}[] 数组 */
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter(function (part) {
      return _typeof(part) === 'object' && part !== null && part.type === 'text' && typeof part.text === 'string';
    }).map(function (part) {
      var _part$text;
      return (_part$text = part.text) !== null && _part$text !== void 0 ? _part$text : '';
    }).join('');
  }
  return '';
}

/** base64 图片 data URI → [image] */
function stripBase64DataUris(text) {
  return text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[image]');
}

/** 提取 role=user/assistant 的消息，清洗 content 并补齐元数据 */
export function extractUserAssistantMessages(messages, opts) {
  var out = [];
  var _iterator = _createForOfIteratorHelper(messages),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _m$timestamp;
      var m = _step.value;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      var text = stripBase64DataUris(extractText(m.content)).trim();
      if (!text) continue;
      out.push({
        id: "msg_".concat(Date.now(), "_").concat(randomBytes(3).toString('hex')),
        role: m.role,
        content: text,
        timestamp: (_m$timestamp = m.timestamp) !== null && _m$timestamp !== void 0 ? _m$timestamp : Date.now()
      });
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return out;
}

/**
 * 把每轮对话的 user/assistant 消息增量、清洗后写入 JSONL 文件
 * （{baseDir}/conversations/YYYY-MM-DD.jsonl），作为 L1 提取的输入真源。
 */
export function recordConversation(_x) {
  return _recordConversation.apply(this, arguments);
}

/** 读取所有日文件（排序）→ 按 sessionKey 行级过滤 → timestamp > afterTimestamp → 截取最新 limit 条 */
function _recordConversation() {
  _recordConversation = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(params) {
    var sessionKey, _params$sessionId, sessionId, userId, agentId, messages, baseDir, originalUserText, afterTimestamp, recordedAt, extracted, target, filtered, records, dayDir, file, _iterator2, _step2, rec;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          sessionKey = params.sessionKey, _params$sessionId = params.sessionId, sessionId = _params$sessionId === void 0 ? sessionKey : _params$sessionId, userId = params.userId, agentId = params.agentId, messages = params.messages, baseDir = params.baseDir, originalUserText = params.originalUserText, afterTimestamp = params.afterTimestamp;
          recordedAt = new Date().toISOString();
          extracted = extractUserAssistantMessages(messages, {
            sessionKey: sessionKey,
            sessionId: sessionId,
            userId: userId,
            agentId: agentId,
            recordedAt: recordedAt
          }); // originalUserText 替换污染 user 消息：按 timestamp 匹配第一条 user 消息替换 content
          if (originalUserText !== undefined) {
            target = extracted.find(function (m) {
              return m.role === 'user';
            });
            if (target) target.content = originalUserText;
          }
          filtered = afterTimestamp === undefined ? extracted : extracted.filter(function (m) {
            return m.timestamp > afterTimestamp;
          });
          if (!(filtered.length === 0)) {
            _context.next = 7;
            break;
          }
          return _context.abrupt("return", []);
        case 7:
          records = filtered.map(function (m) {
            return {
              sessionKey: sessionKey,
              sessionId: sessionId,
              userId: userId,
              agentId: agentId,
              recordedAt: recordedAt,
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp
            };
          });
          dayDir = join(baseDir, 'conversations');
          mkdirSync(dayDir, {
            recursive: true
          });
          file = join(dayDir, "".concat(dateStr(), ".jsonl"));
          _iterator2 = _createForOfIteratorHelper(records);
          try {
            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
              rec = _step2.value;
              appendFileSync(file, "".concat(JSON.stringify(rec), "\n"), 'utf-8');
            }
          } catch (err) {
            _iterator2.e(err);
          } finally {
            _iterator2.f();
          }
          return _context.abrupt("return", records);
        case 14:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _recordConversation.apply(this, arguments);
}
export function readConversationMessages(_x2, _x3, _x4, _x5) {
  return _readConversationMessages.apply(this, arguments);
}
function _readConversationMessages() {
  _readConversationMessages = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(sessionKey, baseDir, afterTimestamp, limit) {
    var dayDir, files, lines, _iterator3, _step3, file, raw, _iterator4, _step4, line, trimmed, rec, sliced;
    return _regeneratorRuntime().wrap(function _callee2$(_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          dayDir = join(baseDir, 'conversations');
          _context2.prev = 1;
          files = readdirSync(dayDir);
          _context2.next = 8;
          break;
        case 5:
          _context2.prev = 5;
          _context2.t0 = _context2["catch"](1);
          return _context2.abrupt("return", []);
        case 8:
          lines = [];
          _iterator3 = _createForOfIteratorHelper(files.sort());
          _context2.prev = 10;
          _iterator3.s();
        case 12:
          if ((_step3 = _iterator3.n()).done) {
            _context2.next = 50;
            break;
          }
          file = _step3.value;
          if (file.endsWith('.jsonl')) {
            _context2.next = 16;
            break;
          }
          return _context2.abrupt("continue", 48);
        case 16:
          raw = readFileSync(join(dayDir, file), 'utf-8');
          _iterator4 = _createForOfIteratorHelper(raw.split('\n'));
          _context2.prev = 18;
          _iterator4.s();
        case 20:
          if ((_step4 = _iterator4.n()).done) {
            _context2.next = 40;
            break;
          }
          line = _step4.value;
          trimmed = line.trim();
          if (trimmed) {
            _context2.next = 25;
            break;
          }
          return _context2.abrupt("continue", 38);
        case 25:
          rec = void 0;
          _context2.prev = 26;
          rec = JSON.parse(trimmed);
          _context2.next = 33;
          break;
        case 30:
          _context2.prev = 30;
          _context2.t1 = _context2["catch"](26);
          return _context2.abrupt("continue", 38);
        case 33:
          if (!(rec.sessionKey !== sessionKey)) {
            _context2.next = 35;
            break;
          }
          return _context2.abrupt("continue", 38);
        case 35:
          if (!(afterTimestamp !== undefined && !(rec.timestamp > afterTimestamp))) {
            _context2.next = 37;
            break;
          }
          return _context2.abrupt("continue", 38);
        case 37:
          lines.push({
            role: rec.role,
            content: rec.content,
            timestamp: rec.timestamp
          });
        case 38:
          _context2.next = 20;
          break;
        case 40:
          _context2.next = 45;
          break;
        case 42:
          _context2.prev = 42;
          _context2.t2 = _context2["catch"](18);
          _iterator4.e(_context2.t2);
        case 45:
          _context2.prev = 45;
          _iterator4.f();
          return _context2.finish(45);
        case 48:
          _context2.next = 12;
          break;
        case 50:
          _context2.next = 55;
          break;
        case 52:
          _context2.prev = 52;
          _context2.t3 = _context2["catch"](10);
          _iterator3.e(_context2.t3);
        case 55:
          _context2.prev = 55;
          _iterator3.f();
          return _context2.finish(55);
        case 58:
          // 按 timestamp 升序整体排序（日文件已排序，此处兜底），再截取最新 limit 条
          lines.sort(function (a, b) {
            return a.timestamp - b.timestamp;
          });
          sliced = limit !== undefined && lines.length > limit ? lines.slice(lines.length - limit) : lines;
          return _context2.abrupt("return", sliced);
        case 61:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 5], [10, 52, 55, 58], [18, 42, 45, 48], [26, 30]]);
  }));
  return _readConversationMessages.apply(this, arguments);
}