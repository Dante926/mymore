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

// src/llm.ts
var llm_exports = {};
__export(llm_exports, {
  LLMRunner: () => LLMRunner
});
module.exports = __toCommonJS(llm_exports);
var LLMRunner = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  async run(params) {
    var _a, _b, _c;
    const messages = [];
    if (params.systemPrompt)
      messages.push({ role: "system", content: params.systemPrompt });
    messages.push({ role: "user", content: params.prompt });
    const timeoutMs = params.timeoutMs ?? this.cfg.timeoutMs ?? 12e4;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          ...params.maxTokens ? { max_tokens: params.maxTokens } : {}
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LLM request failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return ((_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) ?? "";
    } finally {
      clearTimeout(timer);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LLMRunner
});
