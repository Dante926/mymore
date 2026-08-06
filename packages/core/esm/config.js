import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';
var pipelineSchema = z.object({
  everyNConversations: z.number().default(5),
  l1IdleTimeoutSeconds: z.number().default(600),
  l2DelayAfterL1Seconds: z.number().default(90),
  l2MinIntervalSeconds: z.number().default(900),
  l2MaxIntervalSeconds: z.number().default(3600),
  triggerEveryN: z.number().default(10)
});
var llmSchema = z.object({
  baseUrl: z.string().default(''),
  apiKey: z.string().default(''),
  model: z.string().default(''),
  embeddingModel: z.string().optional()
});
var configSchema = z.object({
  llm: z.preprocess(function (v) {
    return v !== null && v !== void 0 ? v : {};
  }, llmSchema),
  pipeline: z.preprocess(function (v) {
    return v !== null && v !== void 0 ? v : {};
  }, pipelineSchema)
});
function resolveRoot(rootDir) {
  return rootDir !== null && rootDir !== void 0 ? rootDir : join(homedir(), '.mymore');
}
export function loadConfig(rootDir) {
  var root = resolveRoot(rootDir);
  var file = join(root, 'config.json');
  var raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : {};
  var parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid mymore config at ".concat(file, ": ").concat(parsed.error.message));
  }
  return parsed.data;
}
export function saveConfig(config, rootDir) {
  var root = resolveRoot(rootDir);
  mkdirSync(root, {
    recursive: true
  });
  writeFileSync(join(root, 'config.json'), JSON.stringify(config, null, 2));
}