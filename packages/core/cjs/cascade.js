var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cascade.ts
var cascade_exports = {};
__export(cascade_exports, {
  CascadeSync: () => CascadeSync
});
module.exports = __toCommonJS(cascade_exports);
var import_storage = require("./storage.js");
var CascadeSync = class {
  constructor(storage, md) {
    this.storage = storage;
    this.md = md;
  }
  syncOne(entry) {
    const sha = (0, import_storage.computeSha256)(entry.content, entry.category, entry.frozen);
    const existing = this.storage.getById(entry.id);
    if (existing && existing.content_sha256 === sha) {
      return { mdPath: existing.md_path, changed: false };
    }
    const mdPath = this.md.writeEntry(entry);
    if (existing) {
      this.storage.updateMdPath(entry.id, mdPath);
      this.storage.updateRow(entry.id, {
        category: entry.category,
        frozen: entry.frozen ? 1 : 0,
        valid_until: entry.valid_until ?? null,
        superseded_by: entry.superseded_by ?? null,
        content_sha256: sha
      });
    } else {
      this.storage.add(entry);
      this.storage.updateMdPath(entry.id, mdPath);
    }
    this.autoCleanup(entry);
    return { mdPath, changed: true };
  }
  scanAndSync() {
    const files = this.md.scanAll();
    let synced = 0;
    let skipped = 0;
    for (const file of files) {
      const entry = this.md.readEntry(file.path);
      if (!entry)
        continue;
      const sha = (0, import_storage.computeSha256)(entry.content, entry.category, entry.frozen);
      const stored = this.storage.getBySha256(sha);
      if (stored && stored.md_path === file.path) {
        skipped++;
        continue;
      }
      this.syncOne(entry);
      synced++;
    }
    const groupFiles = this.md.scanGroups();
    for (const gf of groupFiles) {
      const groupKey = gf.path.replace("groups/", "").replace(".md", "");
      const entries = this.md.readGroupEntries(groupKey);
      for (const entry of entries) {
        const existing = this.storage.getById(entry.id);
        if (existing) {
          if (existing.md_path !== gf.path) {
            this.storage.updateMdPath(entry.id, gf.path);
          }
          skipped++;
          continue;
        }
        try {
          this.storage.add(entry);
          this.storage.updateMdPath(entry.id, gf.path);
          synced++;
        } catch {
          skipped++;
        }
      }
    }
    return { synced, skipped };
  }
  getByMdPath(mdPath) {
    return this.storage.getByMdPath(mdPath);
  }
  autoCleanup(entry) {
    const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString();
    const oldEntries = this.storage.listByOwner(entry.owner_id, 7);
    for (const row of oldEntries) {
      if (row.category === "persistent" && !row.frozen && row.created_at < threeDaysAgo && !row.superseded_by) {
        this.storage.updateRow(row.id, { frozen: 1 });
      }
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CascadeSync
});
