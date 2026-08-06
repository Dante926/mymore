import { loadConfig } from '@mymore/core';

export interface PipelineConfig {
  everyNConversations: number;
  l1IdleTimeoutSeconds: number;
}

/** 与 @mymore/core config.ts pipelineSchema 的默认值保持一致。 */
const DEFAULT_PIPELINE_CFG: PipelineConfig = {
  everyNConversations: 5,
  l1IdleTimeoutSeconds: 600,
};

/**
 * 安全加载管线配置（final review I1）。
 *
 * core 的 loadConfig 在 config.json 缺失/坏 JSON/schema 违规（如 `"pipeline": 5`）
 * 时 throw —— 若在模块顶层裸调，会让 MCP server 启动即死（连旧工具都挂）。
 * 这里包一层 try/catch：任何配置问题都回退 core 默认值，启动绝不因配置而死。
 * 失败原因打到 stderr（MCP stdio 协议通道是 stdout，日志一律走 stderr）。
 */
export function loadPipelineConfig(rootDir: string): PipelineConfig {
  try {
    const cfg = loadConfig(rootDir);
    return {
      everyNConversations: cfg.pipeline.everyNConversations,
      l1IdleTimeoutSeconds: cfg.pipeline.l1IdleTimeoutSeconds,
    };
  } catch (err) {
    console.error(
      `[config] config.json 缺失/损坏，回退默认管线配置 (everyN=${DEFAULT_PIPELINE_CFG.everyNConversations}, l1Idle=${DEFAULT_PIPELINE_CFG.l1IdleTimeoutSeconds}):`,
      (err as Error).message,
    );
    return { ...DEFAULT_PIPELINE_CFG };
  }
}
