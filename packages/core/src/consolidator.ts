import type { MemoryEntry, MemoryRow } from './models.js';
import type { MemoryStorage } from './storage.js';
import type { CascadeSync } from './cascade.js';

export interface DedupResult {
  duplicates: [string, string][];        // [oldId, newId]
  conflicts: [string, string, string][]; // [oldId, newId, reason]
  highlights: string[];
}

export interface ConsolidationSummary {
  archived: number;
  superseded: number;
  frozen: number;
  highlights: string[];
}

export class Consolidator {
  constructor(
    private storage: MemoryStorage,
    private cascade: CascadeSync,
    private llmDedup?: (entries: { id: string; content: string; created_at: string }[]) => Promise<DedupResult>,
  ) {}

  /**
   * Lightweight checks run on every add_memory call.
   */
  autoCleanup(entry: MemoryEntry): void {
    // Auto-freeze: entries older than 3 days get frozen
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const oldEntries = this.storage.listByOwner(entry.owner_id, 7);
    for (const row of oldEntries) {
      if (row.category === 'persistent' && !row.frozen && row.created_at < threeDaysAgo && !row.superseded_by) {
        this.storage.updateRow(row.id, { frozen: 1 });
      }
    }
  }

  async run(input: { owner_id?: string; days?: number; dry_run?: boolean }): Promise<ConsolidationSummary> {
    const summary: ConsolidationSummary = { archived: 0, superseded: 0, frozen: 0, highlights: [] };

    // 1. Archive expired entries
    const expired = this.storage.listExpired();
    for (const row of expired) {
      if (!input.dry_run) {
        this.storage.updateRow(row.id, { category: 'archived', frozen: 0 } as Partial<MemoryRow>);
      }
      summary.archived++;
    }

    // 2. LLM dedup (if configured)
    if (this.llmDedup) {
      const entries = this.storage.listByOwner(input.owner_id ?? '', input.days ?? 7);
      if (entries.length > 1) {
        const result = await this.llmDedup(
          entries.map(e => ({ id: e.id, content: e.content, created_at: e.created_at })),
        );

        if (!input.dry_run) {
          for (const [oldId, newId] of result.duplicates) {
            this.storage.markSuperseded(oldId, newId);
            summary.superseded++;
          }
          for (const [oldId, newId] of result.conflicts) {
            this.storage.markSuperseded(oldId, newId);
            summary.superseded++;
          }
        }

        summary.highlights = result.highlights;

        // Mark highlights as frozen
        if (!input.dry_run && result.highlights.length > 0) {
          const all = this.storage.listByOwner(input.owner_id ?? '', 30, 'persistent');
          for (const hl of result.highlights) {
            const match = all.find(r => r.content.includes(hl.slice(0, 20)));
            if (match) {
              this.storage.updateRow(match.id, { frozen: 1 });
              summary.frozen++;
            }
          }
        }
      }
    }

    return summary;
  }
}
