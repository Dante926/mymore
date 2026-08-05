import { describe, it, expect } from 'vitest';
import { SCHEMA_SQL, MIGRATION_SQL } from '../src/models.js';

describe('models', () => {
  it('SCHEMA_SQL should contain all expected tables', () => {
    expect(SCHEMA_SQL).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS memory_meta');
    expect(SCHEMA_SQL).toContain("tokenize='trigram'");
  });

  it('SCHEMA_SQL should contain all expected indexes', () => {
    expect(SCHEMA_SQL).toContain('idx_memory_track_owner');
    expect(SCHEMA_SQL).toContain('idx_memory_category');
    expect(SCHEMA_SQL).toContain('idx_memory_frozen');
    expect(SCHEMA_SQL).toContain('idx_memory_valid');
  });

  it('SCHEMA_SQL should include the structured columns', () => {
    for (const col of ['type', 'priority', 'scene_name', 'version', 'source_message_ids', 'team', 'agent']) {
      expect(SCHEMA_SQL).toContain(col);
    }
  });

  it('MIGRATION_SQL should add the structured columns', () => {
    for (const col of ['type', 'priority', 'scene_name', 'version', 'source_message_ids', 'team', 'agent']) {
      expect(MIGRATION_SQL).toContain(`ADD COLUMN ${col}`);
    }
  });
});
