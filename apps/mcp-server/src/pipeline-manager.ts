import { readConversationMessages } from '@mymore/core';

export interface L2CallbackResult {
  personaUpdateRequested?: boolean;
  firstScene?: boolean;
}

export interface L3TriggerContext {
  personaUpdateRequested: boolean;
  firstScene: boolean;
}

export interface PipelineManagerOptions {
  baseDir: string;
  sessionKey: string;
  cfg: {
    everyNConversations: number;
    l1IdleTimeoutSeconds: number;
    l2DelayAfterL1Seconds?: number;
    l2MinIntervalSeconds?: number;
    l2MaxIntervalSeconds?: number;
    triggerEveryN?: number;
  };
  onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>, sessionKey?: string) => void;
  /** L2 回调：L1 增量 → SceneExtractor.extractL2（extractL2 失败会 throw，此处捕获降级）。 */
  onL2TimerFired?: () => L2CallbackResult | void | Promise<L2CallbackResult | void>;
  /** L3 回调：PersonaGenerator.generatePersona（内部按 PersonaTrigger 决定是否真跑）。 */
  onL3Triggered?: (ctx: L3TriggerContext) => void | Promise<void>;
}

/** L2/L3 调度默认参数（对齐 spec §4.3，config 未提供时回退）。 */
const DEFAULT_L2_CFG = {
  delayAfterL1Seconds: 90,
  minIntervalSeconds: 900,
  maxIntervalSeconds: 3600,
  triggerEveryN: 10,
};

/** 冷 session 判定阈值：超过 24h 无活跃 → 停 L2 定时器。 */
const COLD_SESSION_MS = 24 * 3600 * 1000;

export interface PersonaTriggerContext {
  requestPersonaUpdate: boolean;
  scenesExist: boolean;
  personaExists: boolean;
  firstScene: boolean;
  memoriesSinceLastPersona: number;
  triggerEveryN: number;
}

/**
 * L3 五级触发判定（对齐 spec §4.3 / reference §2.3）：
 * - P1 request_persona_update：L2 结果带出的显式更新请求（最高优先）；
 * - P2 冷启动：已有场景、尚无 persona.md；
 * - P3 首场景：本批 L2 新建了首个场景；
 * - P4 阈值：自上次 persona 以来的 L1 记忆数 >= triggerEveryN。
 * 全部不命中 → 不生成（保持 persona 稳定，避免 LLM 无谓重写）。
 */
export const PersonaTrigger = {
  shouldGenerate(ctx: PersonaTriggerContext): boolean {
    if (ctx.requestPersonaUpdate) return true; // P1
    if (ctx.scenesExist && !ctx.personaExists) return true; // P2 冷启动
    if (ctx.firstScene) return true; // P3 首场景
    if (ctx.memoriesSinceLastPersona >= ctx.triggerEveryN) return true; // P4 阈值
    return false;
  },
};

export class PipelineManager {
  private conversationCount = 0;
  private warmupThreshold = 1;
  private cfg: {
    everyNConversations: number;
    l1IdleTimeoutSeconds: number;
    l2DelayAfterL1Seconds?: number;
    l2MinIntervalSeconds?: number;
    l2MaxIntervalSeconds?: number;
    triggerEveryN?: number;
  };
  private onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>, sessionKey?: string) => void;
  private lastL1At = 0;
  private lastL1Timestamp = 0;
  private baseDir: string;
  private sessionKey: string;

  // L2/L3 调度（Task 5）
  private lastL2At = 0;
  private lastActiveAt = 0;
  private l2TimerTarget = 0;
  private l3Pending = false;
  private l2Chain: Promise<void> = Promise.resolve();
  private l3Chain: Promise<void> = Promise.resolve();
  private l2DelayAfterL1Ms: number;
  private l2MinIntervalMs: number;
  private l2MaxIntervalMs: number;
  private triggerEveryN: number;
  private l2Callback: () => L2CallbackResult | void | Promise<L2CallbackResult | void>;
  private l3Callback: (ctx: L3TriggerContext) => void | Promise<void>;

  constructor(opts: PipelineManagerOptions) {
    this.baseDir = opts.baseDir;
    this.sessionKey = opts.sessionKey;
    this.cfg = opts.cfg;
    this.onL1Ready = opts.onL1Ready;
    this.l2DelayAfterL1Ms = (opts.cfg.l2DelayAfterL1Seconds ?? DEFAULT_L2_CFG.delayAfterL1Seconds) * 1000;
    this.l2MinIntervalMs = (opts.cfg.l2MinIntervalSeconds ?? DEFAULT_L2_CFG.minIntervalSeconds) * 1000;
    this.l2MaxIntervalMs = (opts.cfg.l2MaxIntervalSeconds ?? DEFAULT_L2_CFG.maxIntervalSeconds) * 1000;
    this.triggerEveryN = opts.cfg.triggerEveryN ?? DEFAULT_L2_CFG.triggerEveryN;
    this.l2Callback = opts.onL2TimerFired ?? (async () => undefined);
    this.l3Callback = opts.onL3Triggered ?? (async () => undefined);
  }

  getEffectiveThreshold(): number {
    return Math.min(this.warmupThreshold, this.cfg.everyNConversations);
  }

  getPendingCount(): number {
    return this.conversationCount;
  }

  notifyTurn(sessionKey?: string): void {
    // Plan 2 I3 接缝：notify handler 投递真实 sessionKey（可能每通知不同），
    // 转发给 onL1Ready，由接线方（bootstrap）用它驱动 per-session 的 L1Runner。
    if (sessionKey) this.sessionKey = sessionKey;
    this.lastActiveAt = Date.now(); // 活跃重置冷 session 时钟
    this.conversationCount++;
    if (this.conversationCount >= this.getEffectiveThreshold()) {
      this.triggerL1();
    }
  }

  private triggerL1(): void {
    this.onL1Ready([], this.sessionKey); // messages wired in Plan 3 (L1 extraction reads L0 itself)
    this.conversationCount = 0;
    this.warmupThreshold *= 2; // advance warm-up: 1→2→4→8→clamped by everyN
    this.lastL1At = Date.now();
    // L1 完成 → advance L2 timer（只提前不延后）
    this.advanceL2Timer();
  }

  // ============================
  // L2/L3 调度级联（Task 5）
  // ============================

  /**
   * L1 完成后的 L2 定时推进：`max(now + delayAfterL1, lastL2At + minInterval)`。
   * 只提前不延后 —— L1 活跃让 L2 尽早跑，但绝不低于 L2 最小间隔。
   */
  advanceL2Timer(): void {
    const now = Date.now();
    this.l2TimerTarget = Math.max(now + this.l2DelayAfterL1Ms, this.lastL2At + this.l2MinIntervalMs);
  }

  /** L2 完成后兜底周期：`now + maxInterval`（无新 L1 也周期性跑 L2）。 */
  armL2MaxInterval(): void {
    this.l2TimerTarget = Date.now() + this.l2MaxIntervalMs;
  }

  getL2TimerTarget(): number {
    return this.l2TimerTarget;
  }

  setLastActive(ts: number): void {
    this.lastActiveAt = ts;
  }

  setL2Callback(cb: () => L2CallbackResult | void | Promise<L2CallbackResult | void>): void {
    this.l2Callback = cb;
  }

  setL3Callback(cb: (ctx: L3TriggerContext) => void | Promise<void>): void {
    this.l3Callback = cb;
  }

  getL3Pending(): boolean {
    return this.l3Pending;
  }

  /** 外部主动触发 L3（无 L2 上下文，P1/P3 为 false，走 P2/P4 判定）。 */
  notifyL3(): void {
    this.triggerL3({ personaUpdateRequested: false, firstScene: false });
  }

  /**
   * L2 定时器触发：冷 session（>24h 无活跃）→ 停（返回 false，不再跑 L2）；
   * 否则推进 lastL2At + 兜底 maxInterval，异步跑 L2 回调，成功后触发 L3。
   * 同步返回布尔（定时器用），L2 回调本身异步 fire-and-forget。
   */
  onL2TimerFired(): boolean {
    const now = Date.now();
    if (this.lastActiveAt > 0 && now - this.lastActiveAt >= COLD_SESSION_MS) {
      this.l2TimerTarget = 0; // 冷 session 停表
      return false;
    }
    this.lastL2At = now;
    this.armL2MaxInterval();
    this.runL2Async();
    return true;
  }

  /** L2 异步执行（串行链避免重叠）：try/catch 捕获 extractL2 的 throw，绝不中断调度。 */
  private runL2Async(): void {
    this.l2Chain = this.l2Chain.then(async () => {
      const ctx: L3TriggerContext = { personaUpdateRequested: false, firstScene: false };
      try {
        const result = await this.l2Callback();
        if (result) {
          ctx.personaUpdateRequested = result.personaUpdateRequested ?? false;
          ctx.firstScene = result.firstScene ?? false;
        }
      } catch (err) {
        console.error(`[pipeline] L2 run failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      this.triggerL3(ctx);
    });
  }

  /**
   * L3 触发：l3Pending 去重（不双跑）；否则置 pending，经全局串行 promise chain 执行
   * L3 回调，完成后清 pending。
   */
  triggerL3(ctx: L3TriggerContext): void {
    if (this.l3Pending) return; // pending 去重
    this.l3Pending = true;
    this.l3Chain = this.l3Chain.then(async () => {
      try {
        await this.l3Callback(ctx);
      } catch (err) {
        console.error(`[pipeline] L3 run failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        this.l3Pending = false;
      }
    });
  }

  async flush(): Promise<void> {
    if (this.conversationCount > 0) this.triggerL1();
  }
}
