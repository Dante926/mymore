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

// src/record/dual-writer.ts
var dual_writer_exports = {};
__export(dual_writer_exports, {
  DualWriter: () => DualWriter
});
module.exports = __toCommonJS(dual_writer_exports);
var import_l1_writer = require("./l1-writer.js");
var DualWriter = class {
  constructor(opts) {
    this.opts = opts;
  }
  async storeL1(record) {
    const { storage, vector, embed, baseDir, team, agent } = this.opts;
    (0, import_l1_writer.appendL1Record)({ ...record, team: record.team ?? team, agent: record.agent ?? agent }, baseDir);
    if (record.version > 1)
      vector.remove(record.id);
    const vec = await embed.embed(record.content);
    vector.upsert(record.id, vec);
    const existing = storage.getById(record.id);
    if (existing) {
      storage.updateRow(record.id, {
        type: record.type,
        priority: record.priority,
        scene_name: record.scene_name,
        version: record.version,
        source_message_ids: JSON.stringify(record.source_message_ids),
        team,
        agent,
        category: "persistent",
        frozen: record.priority >= 90 ? 1 : 0
      });
      storage.updateContent(record.id, record.content);
    } else {
      storage.add({
        id: record.id,
        track: "user",
        owner_id: agent ?? "default",
        category: "persistent",
        content: record.content,
        created_at: record.created_at,
        frozen: record.priority >= 90,
        access_count: 0,
        type: record.type,
        priority: record.priority,
        scene_name: record.scene_name,
        version: record.version,
        source_message_ids: JSON.stringify(record.source_message_ids),
        team,
        agent
      });
    }
    return { id: record.id };
  }
  async deprecateL1(id) {
    this.opts.storage.updateRow(id, { category: "archived", frozen: 0 });
    this.opts.vector.remove(id);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DualWriter
});
