import crypto from 'crypto';
import type { MemoryEntry, MemoryRow } from './models.js';
import type { MemoryStorage } from './storage.js';
import type { CascadeSync } from './cascade.js';
import type { MarkdownHandler } from './markdown.js';

export interface DedupResult {
  duplicates: [string, string][]; // [oldId, newId]
  conflicts: [string, string, string][]; // [oldId, newId, reason]
  highlights: string[];
}

export interface ConsolidationSummary {
  archived: number;
  superseded: number;
  frozen: number;
  noise_cleaned: number;
  purged: number;
  highlights: string[];
}

export class Consolidator {
  constructor(
    private storage: MemoryStorage,
    private cascade: CascadeSync,
    private md: MarkdownHandler,
    private llmDedup?: (entries: { id: string; content: string; created_at: string }[]) => Promise<DedupResult>,
  ) {}

  async run(input: { owner_id?: string; days?: number; dry_run?: boolean; retention_days?: number }): Promise<ConsolidationSummary> {
    const summary: ConsolidationSummary = { archived: 0, superseded: 0, frozen: 0, noise_cleaned: 0, purged: 0, highlights: [] };

    // 1. Archive expired entries
    const expired = this.storage.listExpired();
    for (const row of expired) {
      if (!input.dry_run) {
        this.storage.updateRow(row.id, { category: 'archived', frozen: 0 } as Partial<MemoryRow>);
      }
      summary.archived++;
    }

    // 2. Clean up session-end noise records + raw JSON session metadata + daily summaries
    const allRecent = this.storage.listByOwner(input.owner_id ?? '', 365);
    const noiseRows = allRecent.filter((r) => r.content.startsWith('会话结束于'));
    const jsonNoise = allRecent.filter((r) => r.content.startsWith('{"session_id"') && r.content.includes('"prompt"'));
    const dailySummaries = allRecent.filter((r) => r.group_key?.startsWith('daily-summary:'));
    if (noiseRows.length > 0) {
      // Group by date
      const byDate = new Map<string, typeof noiseRows>();
      for (const row of noiseRows) {
        const date = row.created_at.slice(0, 10);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(row);
      }

      if (!input.dry_run) {
        for (const [date, rows] of byDate) {
          const lines = rows.map((r) => `- 会话活动于 ${r.created_at.slice(11, 19)}`);
          const appendContent = lines.join('\n');
          const uuid = crypto.randomUUID();
          const dailyEntry: MemoryEntry = {
            id: uuid,
            track: 'user',
            owner_id: input.owner_id ?? 'dante926',
            category: 'session',
            content: appendContent,
            created_at: new Date().toISOString(),
            frozen: false,
            access_count: 0,
            group_key: `daily-summary:${date}`,
          };

          // Use appendToGroup so if a summary already exists for this date, merge instead of duplicate
          this.storage.appendToGroup(`daily-summary:${date}`, appendContent, dailyEntry);

          // Mark all noise records for this date as superseded by the (possibly existing) summary
          const existingSummary = this.storage.getByGroupKey(`daily-summary:${date}`, input.owner_id ?? 'dante926', 'session');
          const summaryId = existingSummary?.id ?? uuid;
          for (const row of rows) {
            this.storage.markSuperseded(row.id, summaryId);
          }
          summary.noise_cleaned += rows.length;
        }
      } else {
        summary.noise_cleaned = noiseRows.length;
      }
    }

    // 3. Archive raw JSON session metadata (UserPromptSubmit Hook debris)
    if (jsonNoise.length > 0) {
      if (!input.dry_run) {
        for (const row of jsonNoise) {
          this.storage.updateRow(row.id, { category: 'archived', frozen: 0 } as Partial<MemoryRow>);
        }
      }
      summary.noise_cleaned += jsonNoise.length;
    }

    // 4. Archive daily session summaries (just timestamp lists, no meaningful content)
    if (dailySummaries.length > 0) {
      if (!input.dry_run) {
        for (const row of dailySummaries) {
          this.storage.updateRow(row.id, { category: 'archived', frozen: 0 } as Partial<MemoryRow>);
        }
      }
      summary.noise_cleaned += dailySummaries.length;
    }

    // 5. Deduplicate records sharing the same group_key (keep latest, merge content)
    const grouped = this.storage.listByGroupKey(input.owner_id ?? '');
    if (!input.dry_run) {
      for (const [gk, rows] of Object.entries(grouped)) {
        if (rows.length <= 1) continue;
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const keeper = rows[0];
        const dupes = rows.slice(1);
        for (const dupe of dupes) {
          this.storage.markSuperseded(dupe.id, keeper.id);
        }
        summary.superseded += dupes.length;
      }
    }

    // 6. Purge old archived records beyond retention period
    const retentionDays = input.retention_days ?? 3;
    if (!input.dry_run) {
      const purged = this.storage.purgeArchived(retentionDays);
      for (const p of purged) {
        // Don't delete group files — they contain multiple entries
        if (p.md_path && !p.md_path.startsWith('groups/')) this.md.deleteFile(p.md_path);
      }
      summary.purged = purged.length;
    }

    // 7. Purge superseded records (已替代的记录不会再恢复，硬删除)
    if (!input.dry_run) {
      const purged = this.storage.purgeSuperseded(retentionDays);
      for (const p of purged) {
        if (p.md_path && !p.md_path.startsWith('groups/')) this.md.deleteFile(p.md_path);
      }
      summary.purged += purged.length;
    }

    // 8. LLM dedup (if configured)
    if (this.llmDedup) {
      const entries = this.storage.listByOwner(input.owner_id ?? '', input.days ?? 7);
      if (entries.length > 1) {
        const result = await this.llmDedup(entries.map((e) => ({ id: e.id, content: e.content, created_at: e.created_at })));

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
            const match = all.find((r) => r.content.includes(hl.slice(0, 20)));
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
