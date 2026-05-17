/**
 * GradingService — applies the analyzer-core grading engine to a DealInput,
 * resolving the rubric (thresholds) from caller-provided overrides, the
 * user's saved per-strategy thresholds, or the strategy's default preset.
 *
 * Strategy routing:
 *   BUY_AND_HOLD  → gradeBuyAndHoldDeal
 *   FIX_AND_FLIP  → gradeFixAndFlipDeal, with optional DOM/PIQ auto-resolution
 *                   when the input carries a market identifier (geoId / zip).
 *   BRRRR         → 501 NotImplementedException
 */
import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  BUY_AND_HOLD_DEFAULTS,
  FIX_AND_FLIP_DEFAULTS,
  gradeBuyAndHoldDeal,
  gradeFixAndFlipDeal,
  type DealGradingResult,
  type DealInput,
  type FixAndFlipContext,
  type FixAndFlipInput,
  type FixAndFlipThresholds,
  type GradingContext,
  type Strategy,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import type { GradeDealDto } from './dto/grade-deal.dto';
import type { FixAndFlipInputDto } from './dto/fix-and-flip-input.dto';
import type { FixAndFlipContextDto } from './dto/fix-and-flip-context.dto';
import { MarketResolutionService } from './market-resolution.service';
import { ThresholdsService } from './thresholds.service';

/** Strategy-specific threshold shape returned by resolveThresholds. */
export type StrategyThresholds = UserThresholds | FixAndFlipThresholds;

@Injectable()
export class GradingService {
  constructor(
    private readonly thresholds: ThresholdsService,
    private readonly marketResolution: MarketResolutionService,
  ) {}

  /**
   * Resolution order for the rubric:
   *   1. dto.overrideThresholds (explicit per-request override)
   *   2. user's saved thresholds for the strategy (authenticated only)
   *   3. strategy-default preset
   *
   * For FIX_AND_FLIP, missing context.marketDomDays / marketPiqScore are
   * auto-resolved from market identifiers on the input when available.
   */
  async gradeDeal(
    dto: GradeDealDto,
    userId: string | null,
  ): Promise<DealGradingResult> {
    if (dto.strategy === 'BRRRR') {
      throw new NotImplementedException(
        'BRRRR grading is not yet supported. Use BUY_AND_HOLD or FIX_AND_FLIP.',
      );
    }

    const thresholds = await this.resolveThresholds(
      dto.strategy,
      userId,
      dto.overrideThresholds as StrategyThresholds | undefined,
    );

    if (dto.strategy === 'FIX_AND_FLIP') {
      const flipInput = mapFlipDtoToEngine(
        dto.input as unknown as FixAndFlipInputDto,
      );
      const flipContext = await this.buildFlipContext(
        (dto.context ?? {}) as FixAndFlipContextDto,
        dto.input as unknown as FixAndFlipInputDto,
      );
      return gradeFixAndFlipDeal(
        flipInput,
        flipContext,
        thresholds as FixAndFlipThresholds,
      );
    }

    // BUY_AND_HOLD — DTO is structurally compatible with the engine's DealInput.
    return gradeBuyAndHoldDeal(
      dto.input as DealInput,
      (dto.context ?? {}) as GradingContext,
      thresholds as UserThresholds,
    );
  }

  /**
   * Resolve the rubric for a given strategy + user. Single source of truth.
   * Returns the strategy-appropriate threshold shape; callers narrow.
   */
  async resolveThresholds(
    strategy: Strategy,
    userId: string | null,
    override?: StrategyThresholds,
  ): Promise<StrategyThresholds> {
    if (override) return override;
    if (userId) {
      const saved = await this.thresholds.getThresholds(userId, strategy);
      if (saved) return saved as StrategyThresholds;
    }
    return this.defaultThresholdsFor(strategy);
  }

  /** Per-strategy default preset. BRRRR falls back to B&H until tuned. */
  defaultThresholdsFor(strategy: Strategy): StrategyThresholds {
    if (strategy === 'FIX_AND_FLIP') return FIX_AND_FLIP_DEFAULTS;
    return BUY_AND_HOLD_DEFAULTS;
  }

  /**
   * Build the engine-shaped FixAndFlipContext, auto-resolving marketDomDays
   * and marketPiqScore from market identifiers when the caller didn't
   * provide them explicitly. Explicit context values always win.
   */
  private async buildFlipContext(
    ctx: FixAndFlipContextDto,
    input: FixAndFlipInputDto,
  ): Promise<FixAndFlipContext> {
    const needsLookup =
      (ctx.marketDomDays == null || ctx.marketPiqScore == null) &&
      (input.marketGeoId || input.marketZip || input.marketLat != null);

    let resolved = { marketDomDays: null, marketPiqScore: null } as {
      marketDomDays: number | null;
      marketPiqScore: number | null;
    };
    if (needsLookup) {
      resolved = await this.marketResolution.resolve({
        marketGeoId: input.marketGeoId,
        marketZip: input.marketZip,
        marketLat: input.marketLat,
        marketLng: input.marketLng,
      });
    }

    return {
      rehabVerification: ctx.rehabVerification,
      rehabRiskAccepted: ctx.rehabRiskAccepted,
      arvVerification: ctx.arvVerification,
      extendedHoldAccepted: ctx.extendedHoldAccepted,
      minimumNetProfit: ctx.minimumNetProfit,
      maxAcquisitionMultiplier: ctx.maxAcquisitionMultiplier,
      marketAvgRatePct: ctx.marketAvgRatePct,
      // Explicit context preempts the lookup. nullish-coalesce so an explicit
      // 0 (theoretical) wouldn't be replaced by the lookup either.
      marketDomDays: ctx.marketDomDays ?? resolved.marketDomDays ?? undefined,
      marketPiqScore:
        ctx.marketPiqScore ?? resolved.marketPiqScore ?? undefined,
    };
  }
}

/**
 * Map the API-facing FixAndFlipInputDto to the engine's FixAndFlipInput shape.
 *
 *   purchasePrice          → price
 *   rehabCost              → rehabBudget
 *   loanRate               → interestRatePct
 *   hardMoneyPoints        → points
 *   hardMoneyLtcPct        → derives loanAmount when financingType=hard_money
 *   downPaymentPct         → derives loanAmount when financingType=conventional|private
 *
 * Keeping this mapping in one place lets the engine evolve its field names
 * without breaking API clients.
 */
export function mapFlipDtoToEngine(input: FixAndFlipInputDto): FixAndFlipInput {
  const totalCost = input.purchasePrice + input.rehabCost;
  let loanAmount: number | undefined;
  let downPayment: number | undefined;

  switch (input.financingType) {
    case 'cash':
      loanAmount = undefined;
      downPayment = undefined;
      break;
    case 'hard_money': {
      const ltc = input.hardMoneyLtcPct ?? 0.8;
      loanAmount = totalCost * ltc;
      // Operator funds (1 - ltc) of total cost + closing OOP. Treat as "own
      // equity in the deal" — the engine computes this internally too.
      downPayment = Math.max(0, input.purchasePrice - loanAmount);
      break;
    }
    case 'conventional':
    case 'private': {
      const dpPct = input.downPaymentPct ?? 0.25;
      downPayment = input.purchasePrice * dpPct;
      loanAmount = input.purchasePrice - downPayment;
      break;
    }
  }

  return {
    price: input.purchasePrice,
    arv: input.arv,
    rehabBudget: input.rehabCost,
    holdMonths: input.holdMonths ?? 6,
    buyClosingPct: input.buyClosingPct ?? 0.03,
    rehabContingencyPct: input.rehabContingencyPct ?? 0.1,
    sellingCostsPct: input.sellingCostsPct ?? 0.07,
    propertyTaxAnnual: input.propertyTaxAnnual,
    insuranceAnnual: input.insuranceAnnual,
    utilitiesMonthly: input.utilitiesMonthly ?? 0,
    hoaMonthly: input.hoaMonthly ?? 0,
    financingType: input.financingType,
    loanAmount,
    points: input.hardMoneyPoints,
    interestRatePct: input.loanRate,
    downPayment,
  };
}
