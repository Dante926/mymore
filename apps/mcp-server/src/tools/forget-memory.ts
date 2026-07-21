import { Tool, IMcpTool } from '@midwayjs/mcp';
import { z } from 'zod';
import { getStorage } from '../configuration.js';

@Tool('forget_memory', {
  description: '标记记忆为过时或被替代。不删除数据，保留溯源链',
  inputSchema: {
    id: z.string().describe('记忆 ID'),
    superseded_by: z.string().nullable().optional().describe('替代者 ID，不传则仅标记 archived'),
  },
})
export class ForgetMemoryTool implements IMcpTool {
  async execute(args: { id: string; superseded_by?: string | null }): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }> {
    try {
      const storage = getStorage();
      const existing = storage.getById(args.id);
      if (!existing) {
        return {
          content: [{ type: 'text', text: `记忆 ${args.id} 不存在` }],
          isError: true,
        };
      }

      if (args.superseded_by) {
        storage.markSuperseded(args.id, args.superseded_by);
      } else {
        storage.updateRow(args.id, { category: 'archived', frozen: 0 });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ id: args.id, status: 'forgotten' }),
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
