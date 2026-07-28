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

// src/consolidator.ts
var consolidator_exports = {};
__export(consolidator_exports, {
  Consolidator: () => Consolidator
});
module.exports = __toCommonJS(consolidator_exports);
var import_crypto = __toESM(require("crypto"));
var Consolidator = class {
  constructor(storage, cascade, md, llmDedup) {
    this.storage = storage;
    this.cascade = cascade;
    this.md = md;
    this.llmDedup = llmDedup;
  }
  async run(input) {
    const summary = { archived: 0, superseded: 0, frozen: 0, noise_cleaned: 0, purged: 0, highlights: [] };
    const expired = this.storage.listExpired();
    for (const row of expired) {
      if (!input.dry_run) {
        this.storage.updateRow(row.id, { category: "archived", frozen: 0 });
      }
      summary.archived++;
    }
    const allRecent = this.storage.listByOwner(input.owner_id ?? "", 365);
    const noiseRows = allRecent.filter((r) => r.content.startsWith("会话结束于"));
    const jsonNoise = allRecent.filter((r) => r.content.startsWith('{"session_id"') && r.content.includes('"prompt"'));
    const dailySummaries = allRecent.filter((r) => {
      var _a;
      return (_a = r.group_key) == null ? void 0 : _a.startsWith("daily-summary:");
    });
    if (noiseRows.length > 0) {
      const byDate = /* @__PURE__ */ new Map();
      for (const row of noiseRows) {
        const date = row.created_at.slice(0, 10);
        if (!byDate.has(date))
          byDate.set(date, []);
        byDate.get(date).push(row);
      }
      if (!input.dry_run) {
        for (const [date, rows] of byDate) {
          const lines = rows.map((r) => `- 会话活动于 ${r.created_at.slice(11, 19)}`);
          const appendContent = lines.join("\n");
          const uuid = import_crypto.default.randomUUID();
          const dailyEntry = {
            id: uuid,
            track: "user",
            owner_id: input.owner_id ?? "dante926",
            category: "session",
            content: appendContent,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            frozen: false,
            access_count: 0,
            group_key: `daily-summary:${date}`
          };
          this.storage.appendToGroup(`daily-summary:${date}`, appendContent, dailyEntry);
          const existingSummary = this.storage.getByGroupKey(`daily-summary:${date}`, input.owner_id ?? "dante926", "session");
          const summaryId = (existingSummary == null ? void 0 : existingSummary.id) ?? uuid;
          for (const row of rows) {
            this.storage.markSuperseded(row.id, summaryId);
          }
          summary.noise_cleaned += rows.length;
        }
      } else {
        summary.noise_cleaned = noiseRows.length;
      }
    }
    if (jsonNoise.length > 0) {
      if (!input.dry_run) {
        for (const row of jsonNoise) {
          this.storage.updateRow(row.id, { category: "archived", frozen: 0 });
        }
      }
      summary.noise_cleaned += jsonNoise.length;
    }
    if (dailySummaries.length > 0) {
      if (!input.dry_run) {
        for (const row of dailySummaries) {
          this.storage.updateRow(row.id, { category: "archived", frozen: 0 });
        }
      }
      summary.noise_cleaned += dailySummaries.length;
    }
    const grouped = this.storage.listByGroupKey(input.owner_id ?? "");
    if (!input.dry_run) {
      for (const [gk, rows] of Object.entries(grouped)) {
        if (rows.length <= 1)
          continue;
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const keeper = rows[0];
        const dupes = rows.slice(1);
        for (const dupe of dupes) {
          this.storage.markSuperseded(dupe.id, keeper.id);
        }
        summary.superseded += dupes.length;
      }
    }
    const retentionDays = input.retention_days ?? 3;
    if (!input.dry_run) {
      const purged = this.storage.purgeArchived(retentionDays);
      for (const p of purged) {
        if (p.md_path && !p.md_path.startsWith("groups/"))
          this.md.deleteFile(p.md_path);
      }
      summary.purged = purged.length;
    }
    if (!input.dry_run) {
      const purged = this.storage.purgeSuperseded(retentionDays);
      for (const p of purged) {
        if (p.md_path && !p.md_path.startsWith("groups/"))
          this.md.deleteFile(p.md_path);
      }
      summary.purged += purged.length;
    }
    if (this.llmDedup) {
      const entries = this.storage.listByOwner(input.owner_id ?? "", input.days ?? 7);
      if (entries.length > 1) {
        const result = await this.llmDedup(entries.map((e) => ({ id: e.id, content: e.content, created_at: e.created_at })));
        if (!input.dry_run) {
          for (const [oldId, newId] of result.duplicates) {
            this.storage.markSuperseded(oldId, newId);
            summary.superseded++;
          }
          for (const [oldId, newId] of result.conflicts) {
            this.storage.markSuperseded(oldId, newId);
            summary.superseded++;
          }
        }
        summary.highlights = result.highlights;
        if (!input.dry_run && result.highlights.length > 0) {
          const all = this.storage.listByOwner(input.owner_id ?? "", 30, "persistent");
          for (const hl of result.highlights) {
            const match = all.find((r) => r.content.includes(hl.slice(0, 20)));
            if (match) {
              this.storage.updateRow(match.id, { frozen: 1 });
              summary.frozen++;
            }
          }
        }
      }
    }
    return summary;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Consolidator
});
