function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, relative, dirname } from 'path';
import matter from 'gray-matter';
import { createHash } from 'crypto';
export function mdPathForEntry(rootDir, entry) {
  var trackDir = entry.track === 'agent' ? 'agents' : 'users';
  var dir = join(rootDir, trackDir, entry.owner_id, 'episodes');
  return join(dir, "".concat(entry.id, ".md"));
}
export function groupFilePath(rootDir, groupKey) {
  return join(rootDir, 'groups', "".concat(groupKey, ".md"));
}

/** Parse a group file entry header line: "## timestamp | id | track | category" */
function parseEntryHeader(line) {
  var trimmed = line.replace(/^##\s*/, '').trim();
  var parts = trimmed.split(/\s*\|\s*/);
  if (parts.length < 4) return null;
  var category = parts[3];
  if (category !== 'persistent' && category !== 'session' && category !== 'archived') return null;
  var track = parts[2];
  if (track !== 'user' && track !== 'agent') return null;
  return {
    timestamp: parts[0],
    id: parts[1],
    track: track,
    category: category
  };
}
export var MarkdownHandler = /*#__PURE__*/function () {
  function MarkdownHandler(rootDir) {
    _classCallCheck(this, MarkdownHandler);
    this.rootDir = rootDir;
  }
  _createClass(MarkdownHandler, [{
    key: "writeEntry",
    value: function writeEntry(entry) {
      var filePath = mdPathForEntry(this.rootDir, entry);
      mkdirSync(dirname(filePath), {
        recursive: true
      });
      var frontmatter = {
        id: entry.id,
        track: entry.track,
        owner_id: entry.owner_id,
        category: entry.category,
        frozen: entry.frozen,
        created_at: entry.created_at,
        access_count: entry.access_count
      };
      if (entry.session_id) frontmatter.session_id = entry.session_id;
      if (entry.valid_until) frontmatter.valid_until = entry.valid_until;
      if (entry.superseded_by) frontmatter.superseded_by = entry.superseded_by;
      if (entry.parent_id) frontmatter.parent_id = entry.parent_id;
      if (entry.group_key) frontmatter.group_key = entry.group_key;
      if (entry.last_accessed_at) frontmatter.last_accessed_at = entry.last_accessed_at;

      // One entry per file — always write fresh
      var content = matter.stringify("\n".concat(entry.content), frontmatter);
      writeFileSync(filePath, content);
      return relative(this.rootDir, filePath);
    }
  }, {
    key: "readEntry",
    value: function readEntry(mdPath) {
      var fullPath = join(this.rootDir, mdPath);
      if (!existsSync(fullPath)) return null;
      var raw = readFileSync(fullPath, 'utf-8');
      var parsed = matter(raw);
      var data = parsed.data;
      return {
        id: data.id,
        track: data.track || 'user',
        owner_id: data.owner_id,
        category: data.category || 'persistent',
        content: parsed.content.trim(),
        frozen: Boolean(data.frozen),
        created_at: data.created_at || '',
        valid_until: data.valid_until,
        superseded_by: data.superseded_by,
        session_id: data.session_id,
        parent_id: data.parent_id,
        group_key: data.group_key,
        access_count: data.access_count || 0,
        last_accessed_at: data.last_accessed_at
      };
    }
  }, {
    key: "getEntryId",
    value: function getEntryId(mdPath) {
      var _this$readEntry$id, _this$readEntry;
      return (_this$readEntry$id = (_this$readEntry = this.readEntry(mdPath)) === null || _this$readEntry === void 0 ? void 0 : _this$readEntry.id) !== null && _this$readEntry$id !== void 0 ? _this$readEntry$id : null;
    }
  }, {
    key: "deleteOrMark",
    value: function deleteOrMark(mdPath) {
      // Mark the entry as superseded by editing frontmatter
      var entry = this.readEntry(mdPath);
      if (!entry) return;
      entry.superseded_by = '__deleted__';
      this.writeEntry(entry);
    }
  }, {
    key: "deleteFile",
    value: function deleteFile(mdPath) {
      var fullPath = join(this.rootDir, mdPath);
      try {
        if (existsSync(fullPath)) unlinkSync(fullPath);
      } catch (_unused) {
        // ignore if file doesn't exist or can't be deleted
      }
    }

    // ── Group-append methods ──────────────────────────────────────

    /** Append a single entry to a group markdown file (create if not exists). */
  }, {
    key: "appendToGroup",
    value: function appendToGroup(entry) {
      var _entry$group_key;
      var fp = groupFilePath(this.rootDir, (_entry$group_key = entry.group_key) !== null && _entry$group_key !== void 0 ? _entry$group_key : entry.id);
      mkdirSync(dirname(fp), {
        recursive: true
      });
      if (!existsSync(fp)) {
        var _entry$group_key2;
        // Create new group file with header + first entry
        var header = {
          group_key: (_entry$group_key2 = entry.group_key) !== null && _entry$group_key2 !== void 0 ? _entry$group_key2 : entry.id,
          owner_id: entry.owner_id,
          track: entry.track,
          created_at: entry.created_at,
          updated_at: entry.created_at
        };
        var section = formatGroupSection(entry);
        var content = matter.stringify("\n".concat(section), header);
        writeFileSync(fp, content);
      } else {
        // Read existing, append new section
        var raw = readFileSync(fp, 'utf-8');
        var parsed = matter(raw);
        var body = parsed.content.trimEnd();
        var newBody = body + '\n' + formatGroupSection(entry);
        var _header = _objectSpread(_objectSpread({}, parsed.data), {}, {
          updated_at: entry.created_at
        });
        var _content = matter.stringify("\n".concat(newBody), _header);
        writeFileSync(fp, _content);
      }
      return relative(this.rootDir, fp);
    }

    /** Read all entries from a group file, ordered by append order (oldest first). */
  }, {
    key: "readGroupEntries",
    value: function readGroupEntries(groupKey) {
      var fp = groupFilePath(this.rootDir, groupKey);
      if (!existsSync(fp)) return [];
      var raw = readFileSync(fp, 'utf-8');
      var parsed = matter(raw);
      var header = parsed.data;
      var body = parsed.content.trim();
      if (!body) return [];

      // Split by "\n---\n" entries
      var sections = body.split(/\n---\n/);
      var entries = [];
      var defaultOwner = header.owner_id || 'unknown';
      var _iterator = _createForOfIteratorHelper(sections),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var section = _step.value;
          var trimmed = section.trim();
          if (!trimmed) continue;
          var lines = trimmed.split('\n');
          var headerLine = lines[0];
          var parsedHeader = parseEntryHeader(headerLine);
          if (!parsedHeader) continue;

          // Content is everything after the header line
          var content = lines.slice(1).join('\n').trim();
          entries.push({
            id: parsedHeader.id,
            track: parsedHeader.track,
            owner_id: defaultOwner,
            category: parsedHeader.category,
            content: content,
            created_at: parsedHeader.timestamp,
            group_key: groupKey,
            frozen: false,
            access_count: 0
          });
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      return entries;
    }

    /** Read group file header frontmatter. */
  }, {
    key: "readGroupHeader",
    value: function readGroupHeader(groupKey) {
      var fp = groupFilePath(this.rootDir, groupKey);
      if (!existsSync(fp)) return null;
      var raw = readFileSync(fp, 'utf-8');
      return matter(raw).data;
    }

    /** Scan all group files in memory/groups/. */
  }, {
    key: "scanGroups",
    value: function scanGroups() {
      var results = [];
      var dir = join(this.rootDir, 'groups');
      if (!existsSync(dir)) return results;
      var _iterator2 = _createForOfIteratorHelper(readdirSync(dir)),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var name = _step2.value;
          if (!name.endsWith('.md')) continue;
          var p = join(dir, name);
          if (statSync(p).isDirectory()) continue;
          var content = readFileSync(p, 'utf-8');
          var sha = createHash('sha256').update(content).digest('hex');
          results.push({
            path: relative(this.rootDir, p),
            sha256: sha
          });
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      return results;
    }
  }, {
    key: "scanAll",
    value: function scanAll() {
      var _this = this;
      var results = [];
      var walk = function walk(dir) {
        if (!existsSync(dir)) return;
        var _iterator3 = _createForOfIteratorHelper(readdirSync(dir)),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var name = _step3.value;
            var p = join(dir, name);
            if (statSync(p).isDirectory()) {
              walk(p);
            } else if (name.endsWith('.md')) {
              var content = readFileSync(p, 'utf-8');
              var sha = createHash('sha256').update(content).digest('hex');
              results.push({
                path: relative(_this.rootDir, p),
                sha256: sha
              });
            }
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      };
      walk(join(this.rootDir, 'users'));
      walk(join(this.rootDir, 'agents'));
      return results;
    }
  }]);
  return MarkdownHandler;
}();

/** Format a single entry section for group file. */
function formatGroupSection(entry) {
  var timestamp = entry.created_at;
  var id = entry.id;
  var track = entry.track;
  var category = entry.category;
  return "## ".concat(timestamp, " | ").concat(id, " | ").concat(track, " | ").concat(category, "\n\n").concat(entry.content, "\n\n---");
}