import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';

export interface MyMoreConfig {
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
    embeddingModel?: string;
  };
  pipeline: {
    everyNConversations: number;
    l1IdleTimeoutSeconds: number;
    l2DelayAfterL1Seconds: number;
    l2MinIntervalSeconds: number;
    l2MaxIntervalSeconds: number;
    triggerEveryN: number;
  };
}

const pipelineSchema = z.object({
  everyNConversations: z.number().default(5),
  l1IdleTimeoutSeconds: z.number().default(600),
  l2DelayAfterL1Seconds: z.number().default(90),
  l2MinIntervalSeconds: z.number().default(900),
  l2MaxIntervalSeconds: z.number().default(3600),
  triggerEveryN: z.number().default(10),
});

const llmSchema = z.object({
  baseUrl: z.string().default(''),
  apiKey: z.string().default(''),
  model: z.string().default(''),
  embeddingModel: z.string().optional(),
});

const configSchema = z.object({
  llm: z.preprocess((v) => v ?? {}, llmSchema),
  pipeline: z.preprocess((v) => v ?? {}, pipelineSchema),
});

function resolveRoot(rootDir?: string): string {
  return rootDir ?? join(homedir(), '.mymore');
}

export function loadConfig(rootDir?: string): MyMoreConfig {
  const root = resolveRoot(rootDir);
  const file = join(root, 'config.json');
  const raw: unknown = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf-8'))
    : {};
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid mymore config at ${file}: ${parsed.error.message}`,
    );
  }
  return parsed.data as MyMoreConfig;
}

export function saveConfig(config: MyMoreConfig, rootDir?: string): void {
  const root = resolveRoot(rootDir);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'config.json'), JSON.stringify(config, null, 2));
}
