function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { computeSha256 } from "./storage.js";
export var CascadeSync = /*#__PURE__*/function () {
  function CascadeSync(storage, md) {
    _classCallCheck(this, CascadeSync);
    this.storage = storage;
    this.md = md;
  }
  _createClass(CascadeSync, [{
    key: "syncOne",
    value: function syncOne(entry) {
      // 1. Compute SHA first (before writing to md)
      var sha = computeSha256(entry.content, entry.category, entry.frozen);
      var existing = this.storage.getById(entry.id);
      if (existing && existing.content_sha256 === sha) {
        return {
          mdPath: existing.md_path,
          changed: false
        };
      }

      // 2. Write markdown (only if changed)
      var mdPath = this.md.writeEntry(entry);

      // 3. Upsert FTS5
      if (existing) {
        var _entry$valid_until, _entry$superseded_by;
        this.storage.updateMdPath(entry.id, mdPath);
        this.storage.updateRow(entry.id, {
          category: entry.category,
          frozen: entry.frozen ? 1 : 0,
          valid_until: (_entry$valid_until = entry.valid_until) !== null && _entry$valid_until !== void 0 ? _entry$valid_until : null,
          superseded_by: (_entry$superseded_by = entry.superseded_by) !== null && _entry$superseded_by !== void 0 ? _entry$superseded_by : null,
          content_sha256: sha
        });
      } else {
        this.storage.add(entry);
        this.storage.updateMdPath(entry.id, mdPath);
      }

      // 4. Auto-cleanup old persistent entries
      this.autoCleanup(entry);
      return {
        mdPath: mdPath,
        changed: true
      };
    }
  }, {
    key: "scanAndSync",
    value: function scanAndSync() {
      var files = this.md.scanAll();
      var synced = 0;
      var skipped = 0;
      var _iterator = _createForOfIteratorHelper(files),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var file = _step.value;
          // Re-parse md file and compute proper SHA(content::category::frozen)
          var entry = this.md.readEntry(file.path);
          if (!entry) continue;
          var sha = computeSha256(entry.content, entry.category, entry.frozen);
          var stored = this.storage.getBySha256(sha);
          if (stored && stored.md_path === file.path) {
            skipped++;
            continue;
          }
          this.syncOne(entry);
          synced++;
        }

        // Also reconcile group files with FTS5
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      var groupFiles = this.md.scanGroups();
      var _iterator2 = _createForOfIteratorHelper(groupFiles),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var gf = _step2.value;
          var groupKey = gf.path.replace('groups/', '').replace('.md', '');
          var entries = this.md.readGroupEntries(groupKey);
          var _iterator3 = _createForOfIteratorHelper(entries),
            _step3;
          try {
            for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
              var _entry = _step3.value;
              var existing = this.storage.getById(_entry.id);
              if (existing) {
                // Update md_path if it changed
                if (existing.md_path !== gf.path) {
                  this.storage.updateMdPath(_entry.id, gf.path);
                }
                skipped++;
                continue;
              }
              try {
                this.storage.add(_entry);
                this.storage.updateMdPath(_entry.id, gf.path);
                synced++;
              } catch (_unused) {
                // Entry already exists (race condition or duplicate)
                skipped++;
              }
            }
          } catch (err) {
            _iterator3.e(err);
          } finally {
            _iterator3.f();
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      return {
        synced: synced,
        skipped: skipped
      };
    }
  }, {
    key: "getByMdPath",
    value: function getByMdPath(mdPath) {
      return this.storage.getByMdPath(mdPath);
    }
  }, {
    key: "autoCleanup",
    value: function autoCleanup(entry) {
      var threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      var oldEntries = this.storage.listByOwner(entry.owner_id, 7);
      var _iterator4 = _createForOfIteratorHelper(oldEntries),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var row = _step4.value;
          if (row.category === 'persistent' && !row.frozen && row.created_at < threeDaysAgo && !row.superseded_by) {
            this.storage.updateRow(row.id, {
              frozen: 1
            });
          }
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
    }
  }]);
  return CascadeSync;
}();