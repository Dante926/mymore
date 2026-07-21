import type { MemoryEntry, MemoryRow } from './models.js';
import { computeSha256, type MemoryStorage } from './storage.js';
import type { MarkdownHandler } from './markdown.js';

export class CascadeSync {
  constructor(
    private storage: MemoryStorage,
    private md: MarkdownHandler,
  ) {}

  syncOne(entry: MemoryEntry): { mdPath: string; changed: boolean } {
    // 1. Write markdown first (authoritative source)
    const mdPath = this.md.writeEntry(entry);

    // 2. Check existing FTS5 row by entry ID
    const existing = this.storage.getById(entry.id);
    const sha = computeSha256(entry.content, entry.category, entry.frozen);

    if (existing && existing.content_sha256 === sha && existing.md_path === mdPath) {
      return { mdPath, changed: false }; // No change
    }

    // 3. Upsert FTS5
    if (existing) {
      this.storage.updateMdPath(entry.id, mdPath);
      this.storage.updateRow(entry.id, {
        category: entry.category,
        frozen: entry.frozen ? 1 : 0,
        valid_until: entry.valid_until ?? null,
        superseded_by: entry.superseded_by ?? null,
        content_sha256: sha,
      });
    } else {
      this.storage.add(entry);
      this.storage.updateMdPath(entry.id, mdPath);
    }

    return { mdPath, changed: true };
  }

  scanAndSync(): { synced: number; skipped: number } {
    const files = this.md.scanAll();
    let synced = 0;
    let skipped = 0;

    for (const file of files) {
      const stored = this.storage.getBySha256(file.sha256);
      if (stored && stored.md_path === file.path) {
        skipped++;
        continue;
      }

      // Re-read from md and re-sync
      const entry = this.md.readEntry(file.path);
      if (entry) {
        this.syncOne(entry);
        synced++;
      }
    }

    return { synced, skipped };
  }

  getByMdPath(mdPath: string): MemoryRow | null {
    return this.storage.getByMdPath(mdPath);
  }
}
