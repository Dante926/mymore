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

// src/classifier.ts
var classifier_exports = {};
__export(classifier_exports, {
  classifyMemory: () => classifyMemory
});
module.exports = __toCommonJS(classifier_exports);
function classifyMemory(content, explicitCategory) {
  if (explicitCategory === "persistent" || explicitCategory === "session") {
    return explicitCategory;
  }
  const lower = content.toLowerCase();
  const sessionKeywords = [
    "临时",
    "temp",
    "中间",
    "intermediate",
    "单次",
    "output:",
    "result:",
    "响应:",
    "response:"
  ];
  for (const kw of sessionKeywords) {
    if (lower.includes(kw))
      return "session";
  }
  return "persistent";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  classifyMemory
});
