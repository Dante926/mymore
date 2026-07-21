import { Tool, IMcpTool } from '@midwayjs/mcp';
import { z } from 'zod';
import { getStorage } from '../configuration.js';
import type { Track, Category } from '@mymore/core';

@Tool('search_memory', {
  description: '搜索记忆，支持关键词全文检索和结构化字段过滤',
  inputSchema: {
    query: z.string().describe('搜索关键词'),
    owner_id: z.string().optional().describe('限定用户/Agent'),
    track: z.enum(['user', 'agent']).optional().describe('限定分轨'),
    category: z.enum(['persistent', 'session', 'archived']).optional().describe('限定分类'),
    include_expired: z.boolean().optional().default(false).describe('是否包含过期记忆'),
    limit: z.number().optional().default(5).describe('返回条数'),
  },
})
export class SearchMemoryTool implements IMcpTool {
  async execute(args: {
    query: string;
    owner_id?: string;
    track?: string;
    category?: string;
    include_expired?: boolean;
    limit?: number;
  }): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    try {
      const results = getStorage().search(args.query, {
        owner_id: args.owner_id,
        track: args.track as Track | undefined,
        category: args.category as Category | undefined,
        include_expired: args.include_expired,
        limit: args.limit,
      });

      // Increment access counts
      for (const r of results) {
        getStorage().incrementAccess(r.id);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
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
