/**
 * GradingService — applies the analyzer-core grading engine to a DealInput,
 * resolving the rubric (thresholds) from caller-provided overrides, the
 * user's saved per-strategy thresholds, or the strategy's default preset.
 *
 * Split out of `AnalyzerService` so the analyzer surface stays focused and
 * `AnalyzerService` remains under the CLAUDE.md §1.3 logic-file limit.
 */
import { Injectable } from '@nestjs/common';
import {
  BUY_AND_HOLD_DEFAULTS,
  gradeDeal,
  type DealGradingResult,
  type DealInput,
  type GradingContext,
  type Strategy,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import type { GradeDealDto } from './dto/grade-deal.dto';
import { ThresholdsService } from './thresholds.service';

@Injectable()
export class GradingService {
  constructor(private readonly thresholds: ThresholdsService) {}

  /**
   * Resolution order for the rubric:
   *   1. dto.overrideThresholds (explicit per-request override)
   *   2. user's saved thresholds for the strategy (authenticated only)
   *   3. strategy-default preset
   */
  async gradeDeal(
    dto: GradeDealDto,
    userId: string | null,
  ): Promise<DealGradingResult> {
    const thresholds = await this.resolveThresholds(
      dto.strategy,
      userId,
      dto.overrideThresholds as UserThresholds | undefined,
    );

    // Cast to DealInput — the DTO is structurally compatible (validated
    // shape, narrower unit-range constraints than the analyzer-core type).
    return gradeDeal(
      dto.input as DealInput,
      (dto.context ?? {}) as GradingContext,
      thresholds,
    );
  }

  /**
   * Resolve the rubric for a given strategy + user. Single source of truth for
   * threshold resolution; reused by the upgrade-path endpoint.
   *
   * Resolution order (same as gradeDeal):
   *   1. explicit `override` (per-request)
   *   2. user's saved thresholds for the strategy (authenticated only)
   *   3. strategy-default preset
   */
  async resolveThresholds(
    strategy: Strategy,
    userId: string | null,
    override?: UserThresholds,
  ): Promise<UserThresholds> {
    if (override) return override;
    if (userId) {
      const saved = await this.thresholds.getThresholds(userId, strategy);
      if (saved) return saved;
    }
    return this.defaultThresholdsFor(strategy);
  }

  /**
   * Strategy-default preset. Today only BUY_AND_HOLD has a tuned preset; the
   * flip / BRRRR strategies fall back to the buy-and-hold balanced rubric
   * until strategy-specific presets ship (tracked separately from this PR).
   */
  defaultThresholdsFor(_strategy: Strategy): UserThresholds {
    return BUY_AND_HOLD_DEFAULTS;
  }
}
