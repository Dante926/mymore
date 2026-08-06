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

// src/record/l1-writer.ts
var l1_writer_exports = {};
__export(l1_writer_exports, {
  appendL1Record: () => appendL1Record,
  generateMemoryId: () => generateMemoryId,
  getL1Record: () => getL1Record,
  readL1Records: () => readL1Records
});
module.exports = __toCommonJS(l1_writer_exports);
var import_fs = require("fs");
var import_path = require("path");
var import_crypto = require("crypto");
function dateStr(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 10);
}
function generateMemoryId() {
  return `rec_${Date.now()}_${(0, import_crypto.randomBytes)(3).toString("hex")}`;
}
function appendL1Record(record, baseDir, _team, _agent) {
  const dayDir = (0, import_path.join)(baseDir, "records");
  (0, import_fs.mkdirSync)(dayDir, { recursive: true });
  const file = (0, import_path.join)(dayDir, `${dateStr()}.jsonl`);
  (0, import_fs.appendFileSync)(file, `${JSON.stringify(record)}
`, "utf-8");
  return record.id;
}
function readL1Records(baseDir, opts = {}) {
  const { afterVersion, team, agent, limit } = opts;
  const dayDir = (0, import_path.join)(baseDir, "records");
  let files;
  try {
    files = (0, import_fs.readdirSync)(dayDir);
  } catch {
    return [];
  }
  const records = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".jsonl"))
      continue;
    const raw = (0, import_fs.readFileSync)((0, import_path.join)(dayDir, file), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      let rec;
      try {
        rec = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (team !== void 0 && rec.team !== team)
        continue;
      if (agent !== void 0 && rec.agent !== agent)
        continue;
      if (afterVersion !== void 0 && !(rec.version > afterVersion))
        continue;
      records.push(rec);
    }
  }
  records.sort((a, b) => a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  if (limit !== void 0 && records.length > limit)
    return records.slice(0, limit);
  return records;
}
function getL1Record(id, baseDir) {
  return readL1Records(baseDir).find((r) => r.id === id) ?? null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  appendL1Record,
  generateMemoryId,
  getL1Record,
  readL1Records
});
