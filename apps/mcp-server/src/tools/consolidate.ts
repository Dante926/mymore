import { Tool, IMcpTool } from '@midwayjs/mcp';
import { z } from 'zod';
import { Consolidator } from '@mymore/core';
import { getStorage, getCascade } from '../configuration.js';

@Tool('consolidate', {
  description: '运行归纳：去重、时效淘汰、精华提炼。需要配置 LLM 实现语义去重和精华提取',
  inputSchema: {
    owner_id: z.string().optional().describe('限定范围，不传则扫描全库'),
    days: z.number().optional().default(7).describe('读取最近 N 天的日志'),
    dry_run: z.boolean().optional().default(false).describe('预览模式，不改数据'),
  },
})
export class ConsolidateTool implements IMcpTool {
  async execute(args: { owner_id?: string; days?: number; dry_run?: boolean }): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }> {
    try {
      // Phase 1: LLM-less consolidate (mechanical dedup + archive)
      const consolidator = new Consolidator(getStorage(), getCascade());
      const summary = await consolidator.run(args);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
}
