/**
 * AI Spend Guard
 *
 * In-process, rolling per-UTC-day cost accumulator + hard circuit-breaker for
 * AI completions. Unlike `ai-usage-logger` (which is fire-and-forget and
 * silently no-ops when the DB write fails — e.g. in local dev), this guard
 * lives entirely in memory, so it cannot be silently defeated. It is the
 * backstop against a runaway fan-out/retry loop billing the shared provider key.
 *
 * Cost is derived from the same `estimateCostUsd` / MODEL_PRICING source of
 * truth used by the usage logger, so the two ledgers agree.
 */

import { estimateCostUsd } from './cost-estimator';

/** Thrown by `assertUnderCap()` once the day's estimated spend hits the cap. */
export class AiSpendCapExceededError extends Error {
  /**
   * Circuit-breaker marker: retrying within the same UTC day cannot recover, so
   * retry wrappers (e.g. report-ai-text-helpers `retryWithBackoff`) must fail
   * fast instead of re-throwing it after backoff delays.
   */
  readonly retryable = false;

  constructor(spentUsd: number, capUsd: number, utcDay: string) {
    super(
      `AI daily spend cap reached: $${spentUsd.toFixed(2)} >= $${capUsd.toFixed(
        2,
      )} for ${utcDay} (UTC). New AI calls are blocked until UTC day rollover.`,
    );
    this.name = 'AiSpendCapExceededError';
  }
}

export interface AiSpendGuardOptions {
  /** Hard daily cap in USD. Zero or negative disables the guard entirely. */
  dailyCapUsd: number;
  /** Injectable clock (ms since epoch); defaults to Date.now. */
  now?: () => number;
  /** Injectable warning sink; defaults to a no-op. */
  warn?: (message: string) => void;
}

/** Fractions of the cap at which a one-time warning fires. */
const WARN_THRESHOLDS = [0.5, 0.8, 1.0] as const;

export class AiSpendGuard {
  private readonly capUsd: number;
  private readonly now: () => number;
  private readonly warn: (message: string) => void;

  private currentUtcDay = '';
  private spentUsd = 0;
  private readonly firedThresholds = new Set<number>();

  constructor(opts: AiSpendGuardOptions) {
    this.capUsd = opts.dailyCapUsd;
    this.now = opts.now ?? (() => Date.now());
    this.warn = opts.warn ?? (() => {});
  }

  /** Current spend for today's UTC day (rolls over automatically). */
  getDailySpendUsd(): number {
    this.rollIfNeeded();
    return this.spentUsd;
  }

  /**
   * Throw if today's accumulated spend has reached the cap. No-op when the
   * guard is disabled (cap <= 0). Call this BEFORE dispatching an AI request.
   */
  assertUnderCap(): void {
    if (this.capUsd <= 0) return;
    this.rollIfNeeded();
    if (this.spentUsd >= this.capUsd) {
      throw new AiSpendCapExceededError(
        this.spentUsd,
        this.capUsd,
        this.currentUtcDay,
      );
    }
  }

  /**
   * Record the estimated cost of a completed AI call. Unknown/unpriced models
   * contribute nothing. Fires a one-time warning as each threshold is crossed.
   */
  record(
    model: string,
    promptTokens?: number,
    completionTokens?: number,
  ): void {
    this.rollIfNeeded();
    const cost = estimateCostUsd(model, promptTokens, completionTokens) ?? 0;
    if (cost <= 0) return;
    this.spentUsd += cost;
    if (this.capUsd > 0) this.maybeWarn();
  }

  private rollIfNeeded(): void {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (day !== this.currentUtcDay) {
      this.currentUtcDay = day;
      this.spentUsd = 0;
      this.firedThresholds.clear();
    }
  }

  private maybeWarn(): void {
    const ratio = this.spentUsd / this.capUsd;
    for (const threshold of WARN_THRESHOLDS) {
      if (ratio >= threshold && !this.firedThresholds.has(threshold)) {
        this.firedThresholds.add(threshold);
        this.warn(
          `AI spend at ${Math.round(ratio * 100)}% of daily cap ` +
            `($${this.spentUsd.toFixed(2)} / $${this.capUsd.toFixed(2)}, UTC ${this.currentUtcDay}).`,
        );
      }
    }
  }
}
