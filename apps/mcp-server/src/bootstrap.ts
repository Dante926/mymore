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
const consolidator = new Consolidator(storage, cascade, md);

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
    group_key: z.string().optional(),
  },
  async (args) => {
    try {
      const category = args.category === 'auto'
        ? classifyMemory(args.content)
        : args.category;

      const now = new Date().toISOString();
      const entry = {
        id: uuid(),
        track: args.track,
        owner_id: args.owner_id,
        category,
        content: args.content,
        created_at: now,
        valid_until: args.valid_until ?? undefined,
        session_id: args.session_id ?? undefined,
        frozen: false,
        access_count: 0,
      };

      let mdPath: string;
      let actualId = entry.id;
      if (args.group_key) {
        // Append to existing group (FTS5 + markdown)
        const merged = { ...entry, group_key: args.group_key };
        const row = storage.appendToGroup(args.group_key, args.content, merged);
        actualId = row.id;
        const mdEntry = { ...merged, id: actualId };
        mdPath = md.appendToGroup(mdEntry);
        storage.updateMdPath(actualId, mdPath);
      } else {
        const result = cascade.syncOne(entry);
        mdPath = result.mdPath;
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: actualId, md_path: mdPath, category, group_key: args.group_key ?? null }) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'search_memory',
  {
    query: z.string().optional(),
    owner_id: z.string().optional(),
    track: z.enum(['user', 'agent']).optional(),
    category: z.enum(['persistent', 'session', 'archived']).optional(),
    group_key: z.string().optional(),
    include_expired: z.boolean().optional().default(false),
    limit: z.number().optional().default(20),
  },
  async (args) => {
    try {
      const results = storage.search(args.query, {
        owner_id: args.owner_id,
        track: args.track,
        category: args.category,
        group_key: args.group_key,
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
    retention_days: z.number().optional().describe('清理超过此天数的 archived 记录，默认 30'),
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

server.tool(
  'reflect_memories',
  {
    group_key: z.string().describe('Project group key to reflect on'),
    owner_id: z.string().optional().default('dante926'),
    limit: z.number().optional().default(20),
  },
  async (args) => {
    try {
      // Read raw session entries for this group, grouped by proximity
      const rawEpisodes = storage.search(null, {
        group_key: args.group_key,
        owner_id: args.owner_id,
        category: 'session',
        limit: args.limit,
      });

      if (rawEpisodes.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ episodes: [], message: 'No raw episodes to reflect on.' }) }] };
      }

      // Group nearby entries into conversational clusters (within 5 min)
      const clusters: { time: string; turns: { role: string; content: string }[] }[] = [];
      let current: { time: string; turns: { role: string; content: string }[] } | null = null;

      for (const ep of rawEpisodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        const t = new Date(ep.created_at).getTime();
        if (!current || t - new Date(current.time).getTime() > 300000) {
          current = { time: ep.created_at, turns: [] };
          clusters.push(current);
        }
        current.turns.push({ role: ep.track === 'agent' ? 'assistant' : 'user', content: ep.content.slice(0, 2000) });
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ clusters, total: rawEpisodes.length }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  'deprecate_episodes',
  {
    episode_ids: z.array(z.string()).describe('IDs of raw session entries to mark as deprecated'),
    superseded_by: z.string().describe('ID of the persistent entry that replaces them'),
  },
  async (args) => {
    try {
      for (const id of args.episode_ids) {
        storage.markSuperseded(id, args.superseded_by);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ deprecated: args.episode_ids.length, superseded_by: args.superseded_by }) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
