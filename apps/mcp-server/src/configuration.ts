import { Configuration } from '@midwayjs/core';
import * as mcp from '@midwayjs/mcp';
import * as path from 'path';
import { homedir } from 'os';
import { MemoryStorage, CascadeSync, MarkdownHandler } from '@mymore/core';

let storage: MemoryStorage;
let cascade: CascadeSync;

export function getStorage(): MemoryStorage {
  if (!storage) throw new Error('Storage not initialized');
  return storage;
}

export function getCascade(): CascadeSync {
  if (!cascade) throw new Error('Cascade not initialized');
  return cascade;
}

@Configuration({
  imports: [mcp],
})
export class MainConfiguration {
  async onReady() {
    const rootDir = process.env.MYMORE_ROOT || path.join(homedir(), '.mymore');
    const memoryDir = path.join(rootDir, 'memory');
    const dbPath = path.join(rootDir, '.index', 'memory.db');

    // Ensure directories exist
    const { mkdirSync } = await import('fs');
    mkdirSync(path.join(rootDir, '.index'), { recursive: true });

    storage = new MemoryStorage(dbPath);
    const md = new MarkdownHandler(memoryDir);
    cascade = new CascadeSync(storage, md);

    // Run startup scan
    const scanResult = cascade.scanAndSync();
    console.log(`[mymore] startup scan: ${scanResult.synced} synced, ${scanResult.skipped} skipped`);

    // Load frozen snapshot for Prefix Cache optimization
    const frozen = storage.getFrozenSnapshot('default');
    if (frozen) {
      console.log(`[mymore] frozen snapshot loaded (${frozen.length} chars)`);
    }
  }

  async onStop() {
    storage?.close();
  }
}
