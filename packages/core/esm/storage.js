function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { SCHEMA_SQL, MIGRATION_SQL } from "./models.js";
export function computeSha256(content, category, frozen) {
  return createHash('sha256').update("".concat(content, "::").concat(category, "::").concat(frozen)).digest('hex');
}
export var MemoryStorage = /*#__PURE__*/function () {
  function MemoryStorage(dbPath) {
    _classCallCheck(this, MemoryStorage);
    _defineProperty(this, "db", void 0);
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
    this.runMigration();
  }
  _createClass(MemoryStorage, [{
    key: "runMigration",
    value: function runMigration() {
      try {
        this.db.exec(MIGRATION_SQL);
      } catch (_unused) {
        // column already exists, ignore
      }
    }
  }, {
    key: "add",
    value: function add(entry) {
      var sha = computeSha256(entry.content, entry.category, entry.frozen);
      var insertFts = this.db.prepare('INSERT INTO memory_fts (content) VALUES (?)');
      var insertMeta = this.db.prepare("\n      INSERT INTO memory_meta (id, fts_rowid, track, owner_id, category, md_path,\n        frozen, created_at, valid_until, superseded_by, session_id, parent_id, group_key, content_sha256)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ");
      var addTx = this.db.transaction(function () {
        var _entry$valid_until, _entry$superseded_by, _entry$session_id, _entry$parent_id, _entry$group_key;
        var result = insertFts.run(entry.content);
        var ftsRowid = result.lastInsertRowid;
        insertMeta.run(entry.id, ftsRowid, entry.track, entry.owner_id, entry.category, '',
        // md_path set later
        entry.frozen ? 1 : 0, entry.created_at, (_entry$valid_until = entry.valid_until) !== null && _entry$valid_until !== void 0 ? _entry$valid_until : null, (_entry$superseded_by = entry.superseded_by) !== null && _entry$superseded_by !== void 0 ? _entry$superseded_by : null, (_entry$session_id = entry.session_id) !== null && _entry$session_id !== void 0 ? _entry$session_id : null, (_entry$parent_id = entry.parent_id) !== null && _entry$parent_id !== void 0 ? _entry$parent_id : null, (_entry$group_key = entry.group_key) !== null && _entry$group_key !== void 0 ? _entry$group_key : null, sha);
      });
      addTx();
      return this.getById(entry.id);
    }
  }, {
    key: "appendToGroup",
    value: function appendToGroup(groupKey, content, entry) {
      var existing = this.db.prepare('SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL').get(groupKey, entry.owner_id, entry.category);
      if (existing) {
        var _existingContent$cont;
        // Append to existing FTS entry
        var existingContent = this.db.prepare('SELECT content FROM memory_fts WHERE rowid = ?').get(existing.fts_rowid);
        var updated = ((_existingContent$cont = existingContent === null || existingContent === void 0 ? void 0 : existingContent.content) !== null && _existingContent$cont !== void 0 ? _existingContent$cont : '') + '\n' + content;
        var oldId = existing.id;
        this.db.prepare('UPDATE memory_fts SET content = ? WHERE rowid = ?').run(updated, existing.fts_rowid);
        this.db.prepare('UPDATE memory_meta SET access_count = access_count + 1 WHERE id = ?').run(oldId);

        // Update md file
        var merged = _objectSpread(_objectSpread({}, entry), {}, {
          id: oldId,
          content: updated,
          group_key: groupKey
        });
        this.updateMdPath(oldId, ''); // cascade will set md_path
        return this.getById(oldId);
      }

      // Create new record with group_key
      var newEntry = _objectSpread(_objectSpread({}, entry), {}, {
        group_key: groupKey
      });
      return this.add(newEntry);
    }
  }, {
    key: "search",
    value: function search(query, filters) {
      var _filters$limit,
        _this = this;
      var limit = (_filters$limit = filters === null || filters === void 0 ? void 0 : filters.limit) !== null && _filters$limit !== void 0 ? _filters$limit : 20;
      var queryBuilder = function queryBuilder() {
        var conditions = ['m.superseded_by IS NULL'];
        var params = [];
        if (filters !== null && filters !== void 0 && filters.owner_id) {
          conditions.push('m.owner_id = ?');
          params.push(filters.owner_id);
        }
        if (filters !== null && filters !== void 0 && filters.track) {
          conditions.push('m.track = ?');
          params.push(filters.track);
        }
        if (filters !== null && filters !== void 0 && filters.category) {
          conditions.push('m.category = ?');
          params.push(filters.category);
        }
        if (filters !== null && filters !== void 0 && filters.group_key) {
          conditions.push('m.group_key = ?');
          params.push(filters.group_key);
        }
        if (!(filters !== null && filters !== void 0 && filters.include_expired)) {
          conditions.push('(m.valid_until IS NULL OR m.valid_until > datetime(\'now\'))');
        }
        var where = conditions.length > 0 ? "WHERE ".concat(conditions.join(' AND ')) : '';
        return {
          where: where,
          params: params
        };
      };
      var runQuery = function runQuery(sql, qParams) {
        var _this$db$prepare;
        var rows = (_this$db$prepare = _this.db.prepare(sql)).all.apply(_this$db$prepare, _toConsumableArray(qParams));
        return rows.map(function (r) {
          var _ref, _ref2;
          return {
            id: r.id,
            content: r.content,
            category: r.category,
            track: r.track,
            owner_id: r.owner_id,
            frozen: r.frozen === 1,
            created_at: r.created_at,
            valid_until: (_ref = r.valid_until) !== null && _ref !== void 0 ? _ref : null,
            superseded_by: (_ref2 = r.superseded_by) !== null && _ref2 !== void 0 ? _ref2 : null,
            access_count: r.access_count,
            score: r.score
          };
        });
      };
      var _queryBuilder = queryBuilder(),
        where = _queryBuilder.where,
        params = _queryBuilder.params;
      if (!query) {
        var sql = "\n        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,\n               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score\n        FROM memory_fts f\n        JOIN memory_meta m ON f.rowid = m.fts_rowid\n        ".concat(where, "\n        ORDER BY m.created_at DESC\n        LIMIT ?\n      ");
        return runQuery(sql, [].concat(_toConsumableArray(params), [limit]));
      }
      var hasCJK = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/.test(query);
      var useLike = query.length <= 2 && hasCJK;
      if (useLike) {
        var _sql = "\n        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,\n               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score\n        FROM memory_fts f\n        JOIN memory_meta m ON f.rowid = m.fts_rowid\n        ".concat(where, " AND f.content LIKE ?\n        ORDER BY m.frozen DESC, m.access_count DESC\n        LIMIT ?\n      ");
        return runQuery(_sql, [].concat(_toConsumableArray(params), ["%".concat(query, "%"), limit]));
      }

      // FTS5 trigram MATCH
      var ftsSql = "\n      SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,\n             m.created_at, m.valid_until, m.superseded_by, m.access_count, rank AS score\n      FROM memory_fts f\n      JOIN memory_meta m ON f.rowid = m.fts_rowid\n      ".concat(where, " AND memory_fts MATCH ?\n      ORDER BY m.frozen DESC, rank\n      LIMIT ?\n    ");
      var ftsResults = runQuery(ftsSql, [].concat(_toConsumableArray(params), [query, limit]));

      // FTS5 trigram can miss longer CJK queries — fall back to LIKE
      if (ftsResults.length === 0 && hasCJK) {
        var likeSql = "\n        SELECT m.id, f.content, m.category, m.track, m.owner_id, m.frozen,\n               m.created_at, m.valid_until, m.superseded_by, m.access_count, 1.0 AS score\n        FROM memory_fts f\n        JOIN memory_meta m ON f.rowid = m.fts_rowid\n        ".concat(where, " AND f.content LIKE ?\n        ORDER BY m.created_at DESC\n        LIMIT ?\n      ");
        return runQuery(likeSql, [].concat(_toConsumableArray(params), ["%".concat(query, "%"), limit]));
      }
      return ftsResults;
    }
  }, {
    key: "getById",
    value: function getById(id) {
      var row = this.db.prepare('SELECT * FROM memory_meta WHERE id = ?').get(id);
      if (!row) return null;
      return this.rowToMemoryRow(row);
    }
  }, {
    key: "getBySha256",
    value: function getBySha256(sha) {
      var row = this.db.prepare('SELECT * FROM memory_meta WHERE content_sha256 = ?').get(sha);
      if (!row) return null;
      return this.rowToMemoryRow(row);
    }
  }, {
    key: "getByMdPath",
    value: function getByMdPath(mdPath) {
      var row = this.db.prepare('SELECT * FROM memory_meta WHERE md_path = ?').get(mdPath);
      if (!row) return null;
      return this.rowToMemoryRow(row);
    }
  }, {
    key: "getByGroupKey",
    value: function getByGroupKey(groupKey, ownerId, category) {
      var _this$db$prepare2;
      var sql = category ? 'SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND category = ? AND superseded_by IS NULL' : 'SELECT * FROM memory_meta WHERE group_key = ? AND owner_id = ? AND superseded_by IS NULL';
      var params = category ? [groupKey, ownerId, category] : [groupKey, ownerId];
      var row = (_this$db$prepare2 = this.db.prepare(sql)).get.apply(_this$db$prepare2, params);
      if (!row) return null;
      return this.rowToMemoryRow(row);
    }
  }, {
    key: "getContentById",
    value: function getContentById(id) {
      var _row$content;
      var row = this.db.prepare("\n      SELECT f.content FROM memory_fts f\n      JOIN memory_meta m ON f.rowid = m.fts_rowid\n      WHERE m.id = ?\n    ").get(id);
      return (_row$content = row === null || row === void 0 ? void 0 : row.content) !== null && _row$content !== void 0 ? _row$content : null;
    }
  }, {
    key: "updateMdPath",
    value: function updateMdPath(id, mdPath) {
      this.db.prepare('UPDATE memory_meta SET md_path = ? WHERE id = ?').run(mdPath, id);
    }
  }, {
    key: "updateRow",
    value: function updateRow(id, changes) {
      var _this$db$prepare3;
      var sets = [];
      var params = [];
      var skip = new Set(['id', 'fts_rowid', 'content_sha256', 'created_at']);
      for (var _i = 0, _Object$entries = Object.entries(changes); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];
        if (skip.has(key)) continue;
        sets.push("".concat(key, " = ?"));
        params.push(value !== null && value !== void 0 ? value : null);
      }
      if (sets.length === 0) return;
      params.push(id);
      (_this$db$prepare3 = this.db.prepare("UPDATE memory_meta SET ".concat(sets.join(', '), " WHERE id = ?"))).run.apply(_this$db$prepare3, params);
    }
  }, {
    key: "markSuperseded",
    value: function markSuperseded(id, supersededBy) {
      this.db.prepare("\n      UPDATE memory_meta SET superseded_by = ?, category = 'archived', frozen = 0\n      WHERE id = ? AND superseded_by IS NULL\n    ").run(supersededBy, id);
    }
  }, {
    key: "incrementAccess",
    value: function incrementAccess(id) {
      this.db.prepare("\n      UPDATE memory_meta SET access_count = access_count + 1, last_accessed_at = datetime('now')\n      WHERE id = ?\n    ").run(id);
    }
  }, {
    key: "getFrozenSnapshot",
    value: function getFrozenSnapshot(ownerId) {
      var maxTokens = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 800;
      var rows = this.db.prepare("\n      SELECT f.content FROM memory_fts f\n      JOIN memory_meta m ON f.rowid = m.fts_rowid\n      WHERE m.frozen = 1 AND m.owner_id = ? AND m.superseded_by IS NULL\n      ORDER BY m.access_count DESC\n    ").all(ownerId);
      var parts = [];
      var tokens = 0;
      var _iterator = _createForOfIteratorHelper(rows),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var row = _step.value;
          var approxTokens = Math.ceil(row.content.length / 2);
          if (tokens + approxTokens > maxTokens) break;
          parts.push(row.content);
          tokens += approxTokens;
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      return parts.join('\n');
    }
  }, {
    key: "listExpired",
    value: function listExpired() {
      var _this2 = this;
      var rows = this.db.prepare("\n      SELECT * FROM memory_meta\n      WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND superseded_by IS NULL\n    ").all();
      return rows.map(function (r) {
        return _this2.rowToMemoryRow(r);
      });
    }
  }, {
    key: "purgeArchived",
    value: function purgeArchived() {
      var _this3 = this;
      var retentionDays = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 30;
      var rows = this.db.prepare("\n      SELECT id, md_path, fts_rowid FROM memory_meta\n      WHERE category = 'archived' AND created_at < datetime('now', ?)\n    ").all("-".concat(retentionDays, " days"));
      if (rows.length === 0) return [];
      var purgeTx = this.db.transaction(function () {
        var _iterator2 = _createForOfIteratorHelper(rows),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var row = _step2.value;
            _this3.db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.fts_rowid);
            _this3.db.prepare('DELETE FROM memory_meta WHERE id = ?').run(row.id);
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
      });
      purgeTx();
      return rows.map(function (r) {
        return {
          id: r.id,
          md_path: r.md_path
        };
      });
    }
  }, {
    key: "purgeSuperseded",
    value: function purgeSuperseded() {
      var _this4 = this;
      var days = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 7;
      var rows = this.db.prepare("\n      SELECT id, md_path, fts_rowid FROM memory_meta\n      WHERE superseded_by IS NOT NULL AND created_at < datetime('now', ?)\n    ").all("-".concat(days, " days"));
      if (rows.length === 0) return [];
      var purgeTx = this.db.transaction(function () {
        var _iterator3 = _createForOfIteratorHelper(rows),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var row = _step3.value;
            _this4.db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(row.fts_rowid);
            _this4.db.prepare('DELETE FROM memory_meta WHERE id = ?').run(row.id);
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      });
      purgeTx();
      return rows.map(function (r) {
        return {
          id: r.id,
          md_path: r.md_path
        };
      });
    }
  }, {
    key: "listByOwner",
    value: function listByOwner(ownerId) {
      var _this$db$prepare4;
      var days = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 7;
      var category = arguments.length > 2 ? arguments[2] : undefined;
      var conditions = ['m.owner_id = ?', "m.created_at > datetime('now', ?)", 'm.superseded_by IS NULL'];
      var params = [ownerId, "-".concat(days, " days")];
      if (category) {
        conditions.push('m.category = ?');
        params.push(category);
      }
      var sql = "\n      SELECT m.*, f.content FROM memory_meta m\n      JOIN memory_fts f ON f.rowid = m.fts_rowid\n      WHERE ".concat(conditions.join(' AND '), "\n      ORDER BY m.created_at DESC\n    ");
      return (_this$db$prepare4 = this.db.prepare(sql)).all.apply(_this$db$prepare4, params);
    }
  }, {
    key: "listByGroupKey",
    value: function listByGroupKey(ownerId) {
      var rows = this.db.prepare("\n      SELECT m.*, f.content FROM memory_meta m\n      JOIN memory_fts f ON f.rowid = m.fts_rowid\n      WHERE m.owner_id = ? AND m.group_key IS NOT NULL AND m.superseded_by IS NULL\n      ORDER BY m.group_key, m.created_at\n    ").all(ownerId);
      var grouped = {};
      var _iterator4 = _createForOfIteratorHelper(rows),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var row = _step4.value;
          var gk = row.group_key;
          if (!grouped[gk]) grouped[gk] = [];
          grouped[gk].push(row);
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
      return grouped;
    }
  }, {
    key: "close",
    value: function close() {
      this.db.close();
    }
  }, {
    key: "rowToMemoryRow",
    value: function rowToMemoryRow(row) {
      var _ref3, _ref4, _ref5, _ref6, _ref7, _ref8;
      return {
        id: row.id,
        fts_rowid: row.fts_rowid,
        track: row.track,
        owner_id: row.owner_id,
        category: row.category,
        md_path: row.md_path,
        frozen: row.frozen,
        created_at: row.created_at,
        valid_until: (_ref3 = row.valid_until) !== null && _ref3 !== void 0 ? _ref3 : null,
        superseded_by: (_ref4 = row.superseded_by) !== null && _ref4 !== void 0 ? _ref4 : null,
        session_id: (_ref5 = row.session_id) !== null && _ref5 !== void 0 ? _ref5 : null,
        parent_id: (_ref6 = row.parent_id) !== null && _ref6 !== void 0 ? _ref6 : null,
        group_key: (_ref7 = row.group_key) !== null && _ref7 !== void 0 ? _ref7 : null,
        content_sha256: row.content_sha256,
        access_count: row.access_count,
        last_accessed_at: (_ref8 = row.last_accessed_at) !== null && _ref8 !== void 0 ? _ref8 : null
      };
    }
  }]);
  return MemoryStorage;
}();