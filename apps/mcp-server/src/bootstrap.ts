import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { MemoryStorage, CascadeSync, MarkdownHandler, Consolidator, classifyMemory } from '@mymore/core';
import { v4 as uuid } from 'uuid';

const rootDir = process.env.MYMORE_ROOT || join(homedir(), '.mymore');
const memoryDir = join(rootDir, 'memory');
const dbPath = join(rootDir, '.index', 'memory.db');

mkdirSync(join(rootDir, '.index'), { recursive: true });

const storage = new MemoryStorage(dbPath);
const md = new MarkdownHandler(memoryDir);
const cascade = new CascadeSync(storage, md);
const consolidator = new Consolidator(storage, cascade);

// Startup scan
const scan = cascade.scanAndSync();

const server = new McpServer({
  name: 'mymore-mcp',
  version: '1.0.0',
});

server.tool(
  'add_memory',
  {
    content: z.string(),
    owner_id: z.string(),
    track: z.enum(['user', 'agent']).optional().default('user'),
    category: z.enum(['persistent', 'session', 'auto']).optional().default('auto'),
    valid_until: z.string().datetime({ offset: true }).optional(),
    session_id: z.string().optional(),
  },
  async (args) => {
    try {
      const category = args.category === 'auto'
        ? classifyMemory(args.content)
        : args.category;

      const entry = {
        id: uuid(),
        track: args.track,
        owner_id: args.owner_id,
        category,
        content: args.content,
        created_at: new Date().toISOString(),
        valid_until: args.valid_until ?? undefined,
        session_id: args.session_id ?? undefined,
        frozen: false,
        access_count: 0,
      };

      const result = cascade.syncOne(entry);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: entry.id, md_path: result.mdPath, category }) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'search_memory',
  {
    query: z.string(),
    owner_id: z.string().optional(),
    track: z.enum(['user', 'agent']).optional(),
    category: z.enum(['persistent', 'session', 'archived']).optional(),
    include_expired: z.boolean().optional().default(false),
    limit: z.number().optional().default(5),
  },
  async (args) => {
    try {
      const results = storage.search(args.query, {
        owner_id: args.owner_id,
        track: args.track,
        category: args.category,
        include_expired: args.include_expired,
        limit: args.limit,
      });
      for (const r of results) storage.incrementAccess(r.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'forget_memory',
  {
    id: z.string(),
    superseded_by: z.string().optional(),
  },
  async (args) => {
    try {
      const existing = storage.getById(args.id);
      if (!existing) {
        return { content: [{ type: 'text' as const, text: `记忆 ${args.id} 不存在` }], isError: true };
      }
      if (args.superseded_by) {
        storage.markSuperseded(args.id, args.superseded_by);
      } else {
        storage.updateRow(args.id, { category: 'archived', frozen: 0 } as any);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id, status: 'forgotten' }) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'consolidate',
  {
    owner_id: z.string().optional(),
    days: z.number().optional().default(7),
    dry_run: z.boolean().optional().default(false),
  },
  async (args) => {
    try {
      const summary = await consolidator.run(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
