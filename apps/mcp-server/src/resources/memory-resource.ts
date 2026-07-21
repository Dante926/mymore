import { Resource, IMcpResource } from '@midwayjs/mcp';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getStorage } from '../configuration.js';

@Resource('memory_entry', {
  description: '浏览原始 Markdown 记忆文件',
  uri: 'mymore://memory/{track}/{owner_id}/{kind}/{date}',
  mimeType: 'text/markdown',
})
export class MemoryResource implements IMcpResource {
  async handle(uri: URL): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
    const parts = uri.pathname.split('/').filter(Boolean);
    // Expected: memory/{track}/{owner_id}/{kind}/{date}
    // e.g. memory/user/dante926/episodes/2026-07-21

    if (parts.length < 4) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: '用法: mymore://memory/{track}/{owner_id}/{kind}/{date}',
        }],
      };
    }

    const [, track, ownerId, kind, date] = parts;
    const trackDir = track === 'agent' ? 'agents' : 'users';

    // Build file path
    let mdPath: string;
    const rootDir = process.env.MYMORE_ROOT || join(homedir(), '.mymore', 'memory');

    if (date) {
      mdPath = join(rootDir, trackDir, ownerId, kind, `${kind}-${date}.md`);
    } else {
      mdPath = join(rootDir, trackDir, ownerId, `${kind}.md`);
    }

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
