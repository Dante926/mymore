import type { MemoryEntry, MemoryRow } from './models.js';
import { computeSha256, type MemoryStorage } from './storage.js';
import type { MarkdownHandler } from './markdown.js';

export class CascadeSync {
  constructor(
    private storage: MemoryStorage,
    private md: MarkdownHandler,
  ) {}

  syncOne(entry: MemoryEntry): { mdPath: string; changed: boolean } {
    // 1. Compute SHA first (before writing to md)
    const sha = computeSha256(entry.content, entry.category, entry.frozen);
    const existing = this.storage.getById(entry.id);

    if (existing && existing.content_sha256 === sha) {
      return { mdPath: existing.md_path, changed: false };
    }

    // 2. Write markdown (only if changed)
    const mdPath = this.md.writeEntry(entry);

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

    // 4. Auto-cleanup old persistent entries
    this.autoCleanup(entry);

    return { mdPath, changed: true };
  }

  scanAndSync(): { synced: number; skipped: number } {
    const files = this.md.scanAll();
    let synced = 0;
    let skipped = 0;

    for (const file of files) {
      // Re-parse md file and compute proper SHA(content::category::frozen)
      const entry = this.md.readEntry(file.path);
      if (!entry) continue;

      const sha = computeSha256(entry.content, entry.category, entry.frozen);
      const stored = this.storage.getBySha256(sha);
      if (stored && stored.md_path === file.path) {
        skipped++;
        continue;
      }

      this.syncOne(entry);
      synced++;
    }

    // Also reconcile group files with FTS5
    const groupFiles = this.md.scanGroups();
    for (const gf of groupFiles) {
      const groupKey = gf.path.replace('groups/', '').replace('.md', '');
      const entries = this.md.readGroupEntries(groupKey);
      for (const entry of entries) {
        const existing = this.storage.getById(entry.id);
        if (existing) {
          // Update md_path if it changed
          if (existing.md_path !== gf.path) {
            this.storage.updateMdPath(entry.id, gf.path);
          }
          skipped++;
          continue;
        }
        try {
          this.storage.add(entry);
          this.storage.updateMdPath(entry.id, gf.path);
          synced++;
        } catch {
          // Entry already exists (race condition or duplicate)
          skipped++;
        }
      }
    }

    return { synced, skipped };
  }

  getByMdPath(mdPath: string): MemoryRow | null {
    return this.storage.getByMdPath(mdPath);
  }

  private autoCleanup(entry: MemoryEntry): void {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const oldEntries = this.storage.listByOwner(entry.owner_id, 7);
    for (const row of oldEntries) {
      if (row.category === 'persistent' && !row.frozen && row.created_at < threeDaysAgo && !row.superseded_by) {
        this.storage.updateRow(row.id, { frozen: 1 } as Partial<MemoryRow>);
      }
    }
  }
}
