import { Tool, IMcpTool } from '@midwayjs/mcp';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { classifyMemory } from '@mymore/core';
import { getStorage, getCascade } from '../configuration.js';

@Tool('add_memory', {
  description: '存储一条新记忆，自动三分类并同步到 Markdown 和 FTS5 索引',
  inputSchema: {
    content: z.string().describe('记忆正文'),
    owner_id: z.string().describe('所属用户或 Agent ID'),
    track: z.enum(['user', 'agent']).optional().default('user').describe('分轨'),
    category: z.enum(['persistent', 'session', 'auto']).optional().default('auto').describe('三分类，auto 为自动分类'),
    valid_until: z.string().nullable().optional().describe('有效期 ISO 日期，不传=永不过期'),
    session_id: z.string().nullable().optional().describe('来源会话 ID'),
  },
})
export class AddMemoryTool implements IMcpTool {
  async execute(args: {
    content: string;
    owner_id: string;
    track?: string;
    category?: string;
    valid_until?: string | null;
    session_id?: string | null;
  }): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    try {
      const category = args.category === 'auto'
        ? classifyMemory(args.content)
        : (args.category as 'persistent' | 'session') || 'persistent';

      const entry = {
        id: uuid(),
        track: (args.track as 'user' | 'agent') || 'user',
        owner_id: args.owner_id,
        category,
        content: args.content,
        created_at: new Date().toISOString(),
        valid_until: args.valid_until ?? undefined,
        session_id: args.session_id ?? undefined,
        frozen: false,
        access_count: 0,
      };

      const storage = getStorage();
      const cascade = getCascade();

      const result = cascade.syncOne(entry);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: entry.id,
            md_path: result.mdPath,
            category,
          }),
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
