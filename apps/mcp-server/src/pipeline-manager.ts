import { readConversationMessages } from '@mymore/core';

export interface PipelineManagerOptions {
  baseDir: string;
  sessionKey: string;
  cfg: { everyNConversations: number; l1IdleTimeoutSeconds: number };
  onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>) => void;
}

export class PipelineManager {
  private conversationCount = 0;
  private warmupThreshold = 1;
  private cfg: { everyNConversations: number; l1IdleTimeoutSeconds: number };
  private onL1Ready: (messages: Array<{ role: string; content: string; timestamp: number }>) => void;
  private lastL1At = 0;
  private lastL1Timestamp = 0;
  private baseDir: string;
  private sessionKey: string;

  constructor(opts: PipelineManagerOptions) {
    this.baseDir = opts.baseDir;
    this.sessionKey = opts.sessionKey;
    this.cfg = opts.cfg;
    this.onL1Ready = opts.onL1Ready;
  }

  getEffectiveThreshold(): number {
    return Math.min(this.warmupThreshold, this.cfg.everyNConversations);
  }

  getPendingCount(): number {
    return this.conversationCount;
  }

  notifyTurn(): void {
    this.conversationCount++;
    if (this.conversationCount >= this.getEffectiveThreshold()) {
      this.triggerL1();
    }
  }

  private triggerL1(): void {
    this.onL1Ready([]); // messages wired in Plan 3 (L1 extraction reads L0 itself)
    this.conversationCount = 0;
    this.warmupThreshold *= 2; // advance warm-up: 1→2→4→8→clamped by everyN
    this.lastL1At = Date.now();
  }

  async flush(): Promise<void> {
    if (this.conversationCount > 0) this.triggerL1();
  }
}
