import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PipelineManager } from '../src/pipeline-manager.js';

describe('PipelineManager', () => {
  let dir; let calls: number[] = [];
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'pm-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const make = (everyN = 5) => new PipelineManager({
    baseDir: dir, sessionKey: 'projA',
    cfg: { everyNConversations: everyN, l1IdleTimeoutSeconds: 600 },
    onL1Ready: () => { calls.push(1); },
  });

  it('warm-up: fires at 1, 2, 4 then everyN (clamped)', () => {
    const pm = make(5); calls = [];
    pm.notifyTurn(); expect(calls.length).toBe(1); // warmup 1 → threshold 1, fire (gap 1)
    pm.notifyTurn(); expect(calls.length).toBe(1); // warmup 2, count 1 < 2
    pm.notifyTurn(); expect(calls.length).toBe(2); // threshold 2, fire (gap 2)
    pm.notifyTurn(); expect(calls.length).toBe(2); // warmup 4, count 1 < 4
    pm.notifyTurn(); expect(calls.length).toBe(2); // count 2 < 4
    pm.notifyTurn(); expect(calls.length).toBe(2); // count 3 < 4
    pm.notifyTurn(); expect(calls.length).toBe(3); // threshold 4, fire (gap 4)
    pm.notifyTurn(); expect(calls.length).toBe(3); // warmup 8→clamp 5, count 1 < 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // count 2 < 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // count 3 < 5
    pm.notifyTurn(); expect(calls.length).toBe(3); // count 4 < 5
    pm.notifyTurn(); expect(calls.length).toBe(4); // threshold 5 (clamp), fire (gap 5)
  });

  it('flush triggers onL1Ready with pending', () => {
    const pm = make(5); calls = [];
    pm.notifyTurn(); pm.notifyTurn(); // 2 pending (below threshold 8 now)
    const before = calls.length;
    pm.flush();
    expect(calls.length).toBe(before + 1);
  });

  it('L1 completion advances L2 timer (only earlier)', () => {
    const pm = make(5);
    pm.notifyTurn(); // triggers L1 (warm-up 1)
    // after L1, advanceL2Timer sets target = max(now+delay, lastL2+min)
    const t = pm.getL2TimerTarget();
    expect(t).toBeGreaterThan(Date.now());
  });

  it('cold session stops L2 timer', () => {
    const pm = make(5);
    pm.setLastActive(Date.now() - 25 * 3600 * 1000); // 25h ago
    const fired = pm.onL2TimerFired();
    expect(fired).toBe(false); // stopped, no L2 run
  });

  it('L2 run advances lastL2At and arms maxInterval', () => {
    const pm = make(5);
    pm.setLastActive(Date.now());
    const fired = pm.onL2TimerFired();
    expect(fired).toBe(true);
    const t = pm.getL2TimerTarget();
    expect(t).toBeLessThanOrEqual(Date.now() + 3600 * 1000); // maxInterval 3600
    expect(t).toBeGreaterThan(Date.now() + 900 * 1000); // minInterval 900 → 距离 lastL2At
  });

  it('L3 dedups pending (no double-run)', async () => {
    const pm = make(5);
    let l3Runs = 0;
    pm.setL3Callback(async () => { l3Runs++; });
    pm.setL2Callback(() => { /* no-op */ });
    pm.setLastActive(Date.now());
    pm.notifyL3(); pm.notifyL3(); // two rapid notifications
    await new Promise((r) => setTimeout(r, 0)); // let the L3 chain settle
    expect(l3Runs).toBe(1);
  });
});
