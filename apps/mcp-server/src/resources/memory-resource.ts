import { Resource, IMcpResource } from '@midwayjs/mcp';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getStorage } from '../configuration.js';

@Resource('memory_entry', {
  description: '浏览原始 Markdown 记忆文件',
  uri: 'mymore://memory/{id}',
  mimeType: 'text/markdown',
})
export class MemoryResource implements IMcpResource {
  async handle(uri: URL): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
    const parts = uri.pathname.split('/').filter(Boolean);
    // Expected: memory/{id}

    if (parts.length < 2) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: '用法: mymore://memory/{id}',
        }],
      };
    }

    const id = parts[1];

    // Validate id to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: `Invalid entry ID format: ${id}`,
        }],
      };
    }

    const storage = getStorage();
    const row = storage.getById(id);
    if (!row || !row.md_path) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: `Entry not found: ${id}`,
        }],
      };
    }

    const memoryRoot = process.env.MYMORE_ROOT
      ? join(process.env.MYMORE_ROOT, 'memory')
      : join(homedir(), '.mymore', 'memory');
    const mdPath = join(memoryRoot, row.md_path);

    if (!existsSync(mdPath)) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: `File not found: ${mdPath}`,
        }],
      };
    }

    const content = readFileSync(mdPath, 'utf-8');
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'text/markdown',
        text: content,
      }],
    };
  }
}
