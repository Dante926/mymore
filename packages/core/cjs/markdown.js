var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/markdown.ts
var markdown_exports = {};
__export(markdown_exports, {
  MarkdownHandler: () => MarkdownHandler,
  groupFilePath: () => groupFilePath,
  mdPathForEntry: () => mdPathForEntry
});
module.exports = __toCommonJS(markdown_exports);
var import_fs = require("fs");
var import_path = require("path");
var import_gray_matter = __toESM(require("gray-matter"));
var import_crypto = require("crypto");
function mdPathForEntry(rootDir, entry) {
  const trackDir = entry.track === "agent" ? "agents" : "users";
  const dir = (0, import_path.join)(rootDir, trackDir, entry.owner_id, "episodes");
  return (0, import_path.join)(dir, `${entry.id}.md`);
}
function groupFilePath(rootDir, groupKey) {
  return (0, import_path.join)(rootDir, "groups", `${groupKey}.md`);
}
function parseEntryHeader(line) {
  const trimmed = line.replace(/^##\s*/, "").trim();
  const parts = trimmed.split(/\s*\|\s*/);
  if (parts.length < 4)
    return null;
  const category = parts[3];
  if (category !== "persistent" && category !== "session" && category !== "archived")
    return null;
  const track = parts[2];
  if (track !== "user" && track !== "agent")
    return null;
  return { timestamp: parts[0], id: parts[1], track, category };
}
var MarkdownHandler = class {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }
  writeEntry(entry) {
    const filePath = mdPathForEntry(this.rootDir, entry);
    (0, import_fs.mkdirSync)((0, import_path.dirname)(filePath), { recursive: true });
    const frontmatter = {
      id: entry.id,
      track: entry.track,
      owner_id: entry.owner_id,
      category: entry.category,
      frozen: entry.frozen,
      created_at: entry.created_at,
      access_count: entry.access_count
    };
    if (entry.session_id)
      frontmatter.session_id = entry.session_id;
    if (entry.valid_until)
      frontmatter.valid_until = entry.valid_until;
    if (entry.superseded_by)
      frontmatter.superseded_by = entry.superseded_by;
    if (entry.parent_id)
      frontmatter.parent_id = entry.parent_id;
    if (entry.group_key)
      frontmatter.group_key = entry.group_key;
    if (entry.last_accessed_at)
      frontmatter.last_accessed_at = entry.last_accessed_at;
    const content = import_gray_matter.default.stringify(`
${entry.content}`, frontmatter);
    (0, import_fs.writeFileSync)(filePath, content);
    return (0, import_path.relative)(this.rootDir, filePath);
  }
  readEntry(mdPath) {
    const fullPath = (0, import_path.join)(this.rootDir, mdPath);
    if (!(0, import_fs.existsSync)(fullPath))
      return null;
    const raw = (0, import_fs.readFileSync)(fullPath, "utf-8");
    const parsed = (0, import_gray_matter.default)(raw);
    const data = parsed.data;
    return {
      id: data.id,
      track: data.track || "user",
      owner_id: data.owner_id,
      category: data.category || "persistent",
      content: parsed.content.trim(),
      frozen: Boolean(data.frozen),
      created_at: data.created_at || "",
      valid_until: data.valid_until,
      superseded_by: data.superseded_by,
      session_id: data.session_id,
      parent_id: data.parent_id,
      group_key: data.group_key,
      access_count: data.access_count || 0,
      last_accessed_at: data.last_accessed_at
    };
  }
  getEntryId(mdPath) {
    var _a;
    return ((_a = this.readEntry(mdPath)) == null ? void 0 : _a.id) ?? null;
  }
  deleteOrMark(mdPath) {
    const entry = this.readEntry(mdPath);
    if (!entry)
      return;
    entry.superseded_by = "__deleted__";
    this.writeEntry(entry);
  }
  deleteFile(mdPath) {
    const fullPath = (0, import_path.join)(this.rootDir, mdPath);
    try {
      if ((0, import_fs.existsSync)(fullPath))
        (0, import_fs.unlinkSync)(fullPath);
    } catch {
    }
  }
  // ── Group-append methods ──────────────────────────────────────
  /** Append a single entry to a group markdown file (create if not exists). */
  appendToGroup(entry) {
    const fp = groupFilePath(this.rootDir, entry.group_key ?? entry.id);
    (0, import_fs.mkdirSync)((0, import_path.dirname)(fp), { recursive: true });
    if (!(0, import_fs.existsSync)(fp)) {
      const header = {
        group_key: entry.group_key ?? entry.id,
        owner_id: entry.owner_id,
        track: entry.track,
        created_at: entry.created_at,
        updated_at: entry.created_at
      };
      const section = formatGroupSection(entry);
      const content = import_gray_matter.default.stringify(`
${section}`, header);
      (0, import_fs.writeFileSync)(fp, content);
    } else {
      const raw = (0, import_fs.readFileSync)(fp, "utf-8");
      const parsed = (0, import_gray_matter.default)(raw);
      const body = parsed.content.trimEnd();
      const newBody = body + "\n" + formatGroupSection(entry);
      const header = { ...parsed.data, updated_at: entry.created_at };
      const content = import_gray_matter.default.stringify(`
${newBody}`, header);
      (0, import_fs.writeFileSync)(fp, content);
    }
    return (0, import_path.relative)(this.rootDir, fp);
  }
  /** Read all entries from a group file, ordered by append order (oldest first). */
  readGroupEntries(groupKey) {
    const fp = groupFilePath(this.rootDir, groupKey);
    if (!(0, import_fs.existsSync)(fp))
      return [];
    const raw = (0, import_fs.readFileSync)(fp, "utf-8");
    const parsed = (0, import_gray_matter.default)(raw);
    const header = parsed.data;
    const body = parsed.content.trim();
    if (!body)
      return [];
    const sections = body.split(/\n---\n/);
    const entries = [];
    const defaultOwner = header.owner_id || "unknown";
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed)
        continue;
      const lines = trimmed.split("\n");
      const headerLine = lines[0];
      const parsedHeader = parseEntryHeader(headerLine);
      if (!parsedHeader)
        continue;
      const content = lines.slice(1).join("\n").trim();
      entries.push({
        id: parsedHeader.id,
        track: parsedHeader.track,
        owner_id: defaultOwner,
        category: parsedHeader.category,
        content,
        created_at: parsedHeader.timestamp,
        group_key: groupKey,
        frozen: false,
        access_count: 0
      });
    }
    return entries;
  }
  /** Read group file header frontmatter. */
  readGroupHeader(groupKey) {
    const fp = groupFilePath(this.rootDir, groupKey);
    if (!(0, import_fs.existsSync)(fp))
      return null;
    const raw = (0, import_fs.readFileSync)(fp, "utf-8");
    return (0, import_gray_matter.default)(raw).data;
  }
  /** Scan all group files in memory/groups/. */
  scanGroups() {
    const results = [];
    const dir = (0, import_path.join)(this.rootDir, "groups");
    if (!(0, import_fs.existsSync)(dir))
      return results;
    for (const name of (0, import_fs.readdirSync)(dir)) {
      if (!name.endsWith(".md"))
        continue;
      const p = (0, import_path.join)(dir, name);
      if ((0, import_fs.statSync)(p).isDirectory())
        continue;
      const content = (0, import_fs.readFileSync)(p, "utf-8");
      const sha = (0, import_crypto.createHash)("sha256").update(content).digest("hex");
      results.push({ path: (0, import_path.relative)(this.rootDir, p), sha256: sha });
    }
    return results;
  }
  scanAll() {
    const results = [];
    const walk = (dir) => {
      if (!(0, import_fs.existsSync)(dir))
        return;
      for (const name of (0, import_fs.readdirSync)(dir)) {
        const p = (0, import_path.join)(dir, name);
        if ((0, import_fs.statSync)(p).isDirectory()) {
          walk(p);
        } else if (name.endsWith(".md")) {
          const content = (0, import_fs.readFileSync)(p, "utf-8");
          const sha = (0, import_crypto.createHash)("sha256").update(content).digest("hex");
          results.push({ path: (0, import_path.relative)(this.rootDir, p), sha256: sha });
        }
      }
    };
    walk((0, import_path.join)(this.rootDir, "users"));
    walk((0, import_path.join)(this.rootDir, "agents"));
    return results;
  }
};
function formatGroupSection(entry) {
  const timestamp = entry.created_at;
  const id = entry.id;
  const track = entry.track;
  const category = entry.category;
  return `## ${timestamp} | ${id} | ${track} | ${category}

${entry.content}

---`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MarkdownHandler,
  groupFilePath,
  mdPathForEntry
});
