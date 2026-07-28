function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import crypto from 'crypto';
export var Consolidator = /*#__PURE__*/function () {
  function Consolidator(storage, cascade, md, llmDedup) {
    _classCallCheck(this, Consolidator);
    this.storage = storage;
    this.cascade = cascade;
    this.md = md;
    this.llmDedup = llmDedup;
  }
  _createClass(Consolidator, [{
    key: "run",
    value: function () {
      var _run = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(input) {
        var _input$owner_id,
          _input$owner_id4,
          _input$retention_days,
          _this = this;
        var summary, expired, _iterator, _step, _row4, allRecent, noiseRows, jsonNoise, dailySummaries, byDate, _iterator2, _step2, _row, _date, _iterator3, _step3, _input$owner_id2, _input$owner_id3, _existingSummary$id, _step3$value, date, rows, lines, appendContent, uuid, dailyEntry, existingSummary, summaryId, _iterator4, _step4, row, _iterator5, _step5, _row2, _iterator6, _step6, _row3, grouped, _i, _Object$entries, _Object$entries$_i, gk, _rows, keeper, dupes, _iterator7, _step7, dupe, retentionDays, purged, _iterator8, _step8, p, _purged, _iterator9, _step9, _p, _input$owner_id5, _input$days, _entries, result, _iterator10, _step10, _step10$value, oldId, newId, _iterator11, _step11, _step11$value, _oldId, _newId, _input$owner_id6, all, _iterator12, _step12, _loop;
        return _regeneratorRuntime().wrap(function _callee$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              summary = {
                archived: 0,
                superseded: 0,
                frozen: 0,
                noise_cleaned: 0,
                purged: 0,
                highlights: []
              }; // 1. Archive expired entries
              expired = this.storage.listExpired();
              _iterator = _createForOfIteratorHelper(expired);
              try {
                for (_iterator.s(); !(_step = _iterator.n()).done;) {
                  _row4 = _step.value;
                  if (!input.dry_run) {
                    this.storage.updateRow(_row4.id, {
                      category: 'archived',
                      frozen: 0
                    });
                  }
                  summary.archived++;
                }

                // 2. Clean up session-end noise records + raw JSON session metadata + daily summaries
              } catch (err) {
                _iterator.e(err);
              } finally {
                _iterator.f();
              }
              allRecent = this.storage.listByOwner((_input$owner_id = input.owner_id) !== null && _input$owner_id !== void 0 ? _input$owner_id : '', 365);
              noiseRows = allRecent.filter(function (r) {
                return r.content.startsWith('会话结束于');
              });
              jsonNoise = allRecent.filter(function (r) {
                return r.content.startsWith('{"session_id"') && r.content.includes('"prompt"');
              });
              dailySummaries = allRecent.filter(function (r) {
                var _r$group_key;
                return (_r$group_key = r.group_key) === null || _r$group_key === void 0 ? void 0 : _r$group_key.startsWith('daily-summary:');
              });
              if (noiseRows.length > 0) {
                // Group by date
                byDate = new Map();
                _iterator2 = _createForOfIteratorHelper(noiseRows);
                try {
                  for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                    _row = _step2.value;
                    _date = _row.created_at.slice(0, 10);
                    if (!byDate.has(_date)) byDate.set(_date, []);
                    byDate.get(_date).push(_row);
                  }
                } catch (err) {
                  _iterator2.e(err);
                } finally {
                  _iterator2.f();
                }
                if (!input.dry_run) {
                  _iterator3 = _createForOfIteratorHelper(byDate);
                  try {
                    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                      _step3$value = _slicedToArray(_step3.value, 2), date = _step3$value[0], rows = _step3$value[1];
                      lines = rows.map(function (r) {
                        return "- \u4F1A\u8BDD\u6D3B\u52A8\u4E8E ".concat(r.created_at.slice(11, 19));
                      });
                      appendContent = lines.join('\n');
                      uuid = crypto.randomUUID();
                      dailyEntry = {
                        id: uuid,
                        track: 'user',
                        owner_id: (_input$owner_id2 = input.owner_id) !== null && _input$owner_id2 !== void 0 ? _input$owner_id2 : 'dante926',
                        category: 'session',
                        content: appendContent,
                        created_at: new Date().toISOString(),
                        frozen: false,
                        access_count: 0,
                        group_key: "daily-summary:".concat(date)
                      }; // Use appendToGroup so if a summary already exists for this date, merge instead of duplicate
                      this.storage.appendToGroup("daily-summary:".concat(date), appendContent, dailyEntry);

                      // Mark all noise records for this date as superseded by the (possibly existing) summary
                      existingSummary = this.storage.getByGroupKey("daily-summary:".concat(date), (_input$owner_id3 = input.owner_id) !== null && _input$owner_id3 !== void 0 ? _input$owner_id3 : 'dante926', 'session');
                      summaryId = (_existingSummary$id = existingSummary === null || existingSummary === void 0 ? void 0 : existingSummary.id) !== null && _existingSummary$id !== void 0 ? _existingSummary$id : uuid;
                      _iterator4 = _createForOfIteratorHelper(rows);
                      try {
                        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                          row = _step4.value;
                          this.storage.markSuperseded(row.id, summaryId);
                        }
                      } catch (err) {
                        _iterator4.e(err);
                      } finally {
                        _iterator4.f();
                      }
                      summary.noise_cleaned += rows.length;
                    }
                  } catch (err) {
                    _iterator3.e(err);
                  } finally {
                    _iterator3.f();
                  }
                } else {
                  summary.noise_cleaned = noiseRows.length;
                }
              }

              // 3. Archive raw JSON session metadata (UserPromptSubmit Hook debris)
              if (jsonNoise.length > 0) {
                if (!input.dry_run) {
                  _iterator5 = _createForOfIteratorHelper(jsonNoise);
                  try {
                    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
                      _row2 = _step5.value;
                      this.storage.updateRow(_row2.id, {
                        category: 'archived',
                        frozen: 0
                      });
                    }
                  } catch (err) {
                    _iterator5.e(err);
                  } finally {
                    _iterator5.f();
                  }
                }
                summary.noise_cleaned += jsonNoise.length;
              }

              // 4. Archive daily session summaries (just timestamp lists, no meaningful content)
              if (dailySummaries.length > 0) {
                if (!input.dry_run) {
                  _iterator6 = _createForOfIteratorHelper(dailySummaries);
                  try {
                    for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
                      _row3 = _step6.value;
                      this.storage.updateRow(_row3.id, {
                        category: 'archived',
                        frozen: 0
                      });
                    }
                  } catch (err) {
                    _iterator6.e(err);
                  } finally {
                    _iterator6.f();
                  }
                }
                summary.noise_cleaned += dailySummaries.length;
              }

              // 5. Deduplicate records sharing the same group_key (keep latest, merge content)
              grouped = this.storage.listByGroupKey((_input$owner_id4 = input.owner_id) !== null && _input$owner_id4 !== void 0 ? _input$owner_id4 : '');
              if (input.dry_run) {
                _context2.next = 27;
                break;
              }
              _i = 0, _Object$entries = Object.entries(grouped);
            case 14:
              if (!(_i < _Object$entries.length)) {
                _context2.next = 27;
                break;
              }
              _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2), gk = _Object$entries$_i[0], _rows = _Object$entries$_i[1];
              if (!(_rows.length <= 1)) {
                _context2.next = 18;
                break;
              }
              return _context2.abrupt("continue", 24);
            case 18:
              _rows.sort(function (a, b) {
                return b.created_at.localeCompare(a.created_at);
              });
              keeper = _rows[0];
              dupes = _rows.slice(1);
              _iterator7 = _createForOfIteratorHelper(dupes);
              try {
                for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
                  dupe = _step7.value;
                  this.storage.markSuperseded(dupe.id, keeper.id);
                }
              } catch (err) {
                _iterator7.e(err);
              } finally {
                _iterator7.f();
              }
              summary.superseded += dupes.length;
            case 24:
              _i++;
              _context2.next = 14;
              break;
            case 27:
              // 6. Purge old archived records beyond retention period
              retentionDays = (_input$retention_days = input.retention_days) !== null && _input$retention_days !== void 0 ? _input$retention_days : 3;
              if (!input.dry_run) {
                purged = this.storage.purgeArchived(retentionDays);
                _iterator8 = _createForOfIteratorHelper(purged);
                try {
                  for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
                    p = _step8.value;
                    // Don't delete group files — they contain multiple entries
                    if (p.md_path && !p.md_path.startsWith('groups/')) this.md.deleteFile(p.md_path);
                  }
                } catch (err) {
                  _iterator8.e(err);
                } finally {
                  _iterator8.f();
                }
                summary.purged = purged.length;
              }

              // 7. Purge superseded records (已替代的记录不会再恢复，硬删除)
              if (!input.dry_run) {
                _purged = this.storage.purgeSuperseded(retentionDays);
                _iterator9 = _createForOfIteratorHelper(_purged);
                try {
                  for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
                    _p = _step9.value;
                    if (_p.md_path && !_p.md_path.startsWith('groups/')) this.md.deleteFile(_p.md_path);
                  }
                } catch (err) {
                  _iterator9.e(err);
                } finally {
                  _iterator9.f();
                }
                summary.purged += _purged.length;
              }

              // 8. LLM dedup (if configured)
              if (!this.llmDedup) {
                _context2.next = 56;
                break;
              }
              _entries = this.storage.listByOwner((_input$owner_id5 = input.owner_id) !== null && _input$owner_id5 !== void 0 ? _input$owner_id5 : '', (_input$days = input.days) !== null && _input$days !== void 0 ? _input$days : 7);
              if (!(_entries.length > 1)) {
                _context2.next = 56;
                break;
              }
              _context2.next = 35;
              return this.llmDedup(_entries.map(function (e) {
                return {
                  id: e.id,
                  content: e.content,
                  created_at: e.created_at
                };
              }));
            case 35:
              result = _context2.sent;
              if (!input.dry_run) {
                _iterator10 = _createForOfIteratorHelper(result.duplicates);
                try {
                  for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
                    _step10$value = _slicedToArray(_step10.value, 2), oldId = _step10$value[0], newId = _step10$value[1];
                    this.storage.markSuperseded(oldId, newId);
                    summary.superseded++;
                  }
                } catch (err) {
                  _iterator10.e(err);
                } finally {
                  _iterator10.f();
                }
                _iterator11 = _createForOfIteratorHelper(result.conflicts);
                try {
                  for (_iterator11.s(); !(_step11 = _iterator11.n()).done;) {
                    _step11$value = _slicedToArray(_step11.value, 2), _oldId = _step11$value[0], _newId = _step11$value[1];
                    this.storage.markSuperseded(_oldId, _newId);
                    summary.superseded++;
                  }
                } catch (err) {
                  _iterator11.e(err);
                } finally {
                  _iterator11.f();
                }
              }
              summary.highlights = result.highlights;

              // Mark highlights as frozen
              if (!(!input.dry_run && result.highlights.length > 0)) {
                _context2.next = 56;
                break;
              }
              all = this.storage.listByOwner((_input$owner_id6 = input.owner_id) !== null && _input$owner_id6 !== void 0 ? _input$owner_id6 : '', 30, 'persistent');
              _iterator12 = _createForOfIteratorHelper(result.highlights);
              _context2.prev = 41;
              _loop = /*#__PURE__*/_regeneratorRuntime().mark(function _loop() {
                var hl, match;
                return _regeneratorRuntime().wrap(function _loop$(_context) {
                  while (1) switch (_context.prev = _context.next) {
                    case 0:
                      hl = _step12.value;
                      match = all.find(function (r) {
                        return r.content.includes(hl.slice(0, 20));
                      });
                      if (match) {
                        _this.storage.updateRow(match.id, {
                          frozen: 1
                        });
                        summary.frozen++;
                      }
                    case 3:
                    case "end":
                      return _context.stop();
                  }
                }, _loop);
              });
              _iterator12.s();
            case 44:
              if ((_step12 = _iterator12.n()).done) {
                _context2.next = 48;
                break;
              }
              return _context2.delegateYield(_loop(), "t0", 46);
            case 46:
              _context2.next = 44;
              break;
            case 48:
              _context2.next = 53;
              break;
            case 50:
              _context2.prev = 50;
              _context2.t1 = _context2["catch"](41);
              _iterator12.e(_context2.t1);
            case 53:
              _context2.prev = 53;
              _iterator12.f();
              return _context2.finish(53);
            case 56:
              return _context2.abrupt("return", summary);
            case 57:
            case "end":
              return _context2.stop();
          }
        }, _callee, this, [[41, 50, 53, 56]]);
      }));
      function run(_x) {
        return _run.apply(this, arguments);
      }
      return run;
    }()
  }]);
  return Consolidator;
}();