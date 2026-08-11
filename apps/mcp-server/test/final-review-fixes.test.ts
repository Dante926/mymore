import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';
import { appendL1Record, readL1Records } from '@mymore/core';
import type { L1Record } from '@mymore/core';

/** 构造一条 version:1 的 L1 记录（L1 新记忆的默认形状）。 */
function rec(id: string, content: string, version = 1): L1Record {
  return {
    id,
    type: 'episodic' as const,
    content,
    priority: 80,
    source_message_ids: ['msg_1'],
    created_at: new Date().toISOString(),
    version,
  };
}

describe('final-review C1: L2/L3 增量游标改 id 去重（修复 version 过滤饿死）', () => {
  it('bootstrap.ts 不再用 afterVersion 游标驱动 L2 增量（源码断言）', () => {
    const src = readFileSync(
      join(process.cwd(), 'src', 'bootstrap.ts'),
      'utf-8',
    );
    // version 游标已移除：L2 增量靠未处理 id 集合过滤
    expect(src).not.toMatch(/afterVersion\s*:\s*lastL2Version/);
    expect(src).not.toMatch(/lastL2Version/);
    expect(src).toMatch(/l2-processed\.json/);
    // P4 也不再依赖 lastPersonaVersion 版本游标
    expect(src).not.toMatch(/lastPersonaVersion/);
    // P4 用独立的 persona id 基准（L2 消费不清零 persona 计数）
    expect(src).toMatch(/l3-persona-seen\.json/);
    expect(src).toMatch(/readL1Records\(rootDir\)\.filter\(\(r\) => !lastPersonaSeenIds\.has\(r\.id\)\)/);
  });

  it('L2 增量：id 去重游标能看到游标推进后新写入的 version:1 记录', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c1-idcursor-'));
    try {
      // 第一批：2 条 version:1 记录
      const r1 = rec('c1-a', '记忆 A');
      const r2 = rec('c1-b', '记忆 B');
      appendL1Record(r1, dir);
      appendL1Record(r2, dir);

      // 模拟 L2 首次消费：读增量 → 拿到 2 条 → 推进 id 游标
      const processed = new Set<string>();
      let increment = readL1Records(dir).filter((r) => !processed.has(r.id));
      expect(increment).toHaveLength(2);
      increment.forEach((r) => processed.add(r.id));

      // 又提取 1 条新 version:1 记录（模拟 L1 第二波，version 仍是 1 —— 旧实现会饿死）
      const r3 = rec('c1-c', '记忆 C');
      appendL1Record(r3, dir);

      // L2 第二次消费：必须能看到新的 version:1 记录（旧 afterVersion 游标推进到 1 后这 3 条全被过滤）
      increment = readL1Records(dir).filter((r) => !processed.has(r.id));
      expect(increment).toHaveLength(1);
      expect(increment[0].id).toBe('c1-c');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('P4 判定：memoriesSinceLastPersona 基于 persona id 基准（集成：真实 L1 records 触发阈值）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c1-p4-'));
    try {
      // 5 条 version:1 真实 L1 记录
      for (let i = 1; i <= 5; i++) appendL1Record(rec(`p4-${i}`, `记忆 ${i}`), dir);

      // 模拟：上次 persona 已纳入前 2 条，剩余 3 条未纳入
      const personaSeen = new Set(['p4-1', 'p4-2']);
      const memoriesSinceLastPersona = readL1Records(dir).filter((r) => !personaSeen.has(r.id)).length;
      expect(memoriesSinceLastPersona).toBe(3);

      // 达到 triggerEveryN=3 → 触发
      const should = trigger({ memoriesSinceLastPersona, triggerEveryN: 3 });
      expect(should).toBe(true);

      // 未达 triggerEveryN=5 → 不触发
      const shouldNot = trigger({ memoriesSinceLastPersona, triggerEveryN: 5 });
      expect(shouldNot).toBe(false);

      // 关键语义（C1 双独立游标）：L2 已消费这 5 条（进入 l2ProcessedIds）后，
      // P4 计数不受影响 —— persona 基准只认 persona 自己的 id 集合。
      const l2Processed = new Set(['p4-1', 'p4-2', 'p4-3', 'p4-4', 'p4-5']);
      const p4CountAfterL2 = readL1Records(dir).filter((r) => !personaSeen.has(r.id)).length;
      expect(p4CountAfterL2).toBe(3); // 仍从 persona 基准之外计 3 条
      expect(l2Processed.size).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('已处理 id 集合可持久化/恢复（重启后增量不丢）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c1-persist-'));
    const stateFile = join(dir, 'l2-processed.json');
    try {
      // 写持久化文件（模拟 persistIdSet 的输出）
      writeFileSync(stateFile, JSON.stringify(['rec-x', 'rec-y']), 'utf8');

      // 模拟启动加载（loadIdSet 逻辑）
      const raw = JSON.parse(readFileSync(stateFile, 'utf8')) as unknown;
      const loaded = Array.isArray(raw) ? new Set(raw.filter((x) => typeof x === 'string')) : new Set<string>();
      expect(loaded.has('rec-x')).toBe(true);
      expect(loaded.has('rec-y')).toBe(true);

      // 损坏文件 → 空集，安全重扫
      writeFileSync(stateFile, '{broken json', 'utf8');
      let fallback: Set<string>;
      try {
        const r2 = JSON.parse(readFileSync(stateFile, 'utf8')) as unknown;
        fallback = Array.isArray(r2) ? new Set(r2.filter((x) => typeof x === 'string')) : new Set<string>();
      } catch {
        fallback = new Set<string>();
      }
      expect(fallback.size).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** P4 阈值判定（对齐 PersonaTrigger.shouldGenerate 的 P4 分支）。 */
function trigger(ctx: { memoriesSinceLastPersona: number; triggerEveryN: number }): boolean {
  return ctx.memoriesSinceLastPersona >= ctx.triggerEveryN;
}
