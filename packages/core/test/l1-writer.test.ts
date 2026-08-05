import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendL1Record, readL1Records, getL1Record, generateMemoryId } from '../src/record/l1-writer.js';

function base() {
  return {
    id: generateMemoryId(), type: 'episodic' as const,
    content: '用户确认方案A', priority: 82, scene_name: '做改造设计',
    source_message_ids: ['msg_1'], created_at: new Date().toISOString(),
    version: 2, team: 'dante', agent: 'arch',
  };
}

describe('L1 writer', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'l1-test-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('appends and reads back', () => {
    const rec = {
      id: generateMemoryId(), type: 'episodic' as const,
      content: '用户确认方案A', priority: 82, scene_name: '做改造设计',
      source_message_ids: ['msg_1'], created_at: new Date().toISOString(),
      version: 2, team: 'dante', agent: 'arch',
    };
    const id = appendL1Record(rec, dir);
    const all = readL1Records(dir, { team: 'dante' });
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(id);
    expect(all[0].priority).toBe(82);
    expect(getL1Record(id, dir)!.type).toBe('episodic');
  });

  it('filters by team', () => {
    appendL1Record({ ...base(), team: 'other' }, dir);
    const mine = readL1Records(dir, { team: 'dante' });
    const all = readL1Records(dir);
    expect(mine).toHaveLength(1);
    expect(all).toHaveLength(2);
  });
});
