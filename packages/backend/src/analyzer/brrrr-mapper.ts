/**
 * Map the API-facing BrrrrInputDto to the engine's BrrrrGradingInput shape.
 *
 * Most fields pass through unchanged — the BRRRR engine was designed
 * alongside the DTO so they share field names. The only derived value is the
 * hard-money loan amount, which we compute from the loan-to-cost cap times
 * total cost (purchase + rehab) — same convention as F&F's
 * mapFlipDtoToEngine.
 *
 * Kept in a sibling file so grading.service.ts stays under the 300-line
 * logic-file limit.
 */
import type {
  BrrrrGradingInput,
  BrrrrInitialFinancingType,
} from '@propertyiq/analyzer-core';
import type { BrrrrInputDto } from './dto/brrrr-input.dto';

export function mapBrrrrDtoToEngine(input: BrrrrInputDto): BrrrrGradingInput {
  const financingType: BrrrrInitialFinancingType = input.initialFinancingType;

  let hardMoneyLoanAmount: number | undefined;
  if (financingType === 'hard_money') {
    const ltc = input.hardMoneyLtcPct ?? 0.8;
    const totalCost = input.purchasePrice + input.rehabCost;
    hardMoneyLoanAmount = totalCost * ltc;
  }

  return {
    // Acquisition
    purchasePrice: input.purchasePrice,
    arv: input.arv,
    rehabCost: input.rehabCost,
    rehabContingencyPct: input.rehabContingencyPct ?? 0.1,
    buyClosingPct: input.buyClosingPct ?? 0.03,
    holdMonthsBeforeRefi: input.holdMonthsBeforeRefi,

    // Initial financing
    initialFinancingType: financingType,
    hardMoneyLoanAmount,
    hardMoneyRate: input.hardMoneyRate,
    hardMoneyPoints: input.hardMoneyPoints,
    rehabNotFinanced: input.rehabNotFinanced,
    holdingCashOutOfPocket: input.holdingCashOutOfPocket ?? 0,
    interestPaidOutOfPocket: input.interestPaidOutOfPocket ?? 0,

    // Property carry
    propertyTaxAnnual: input.propertyTaxAnnual,
    insuranceAnnual: input.insuranceAnnual,
    utilitiesMonthly: input.utilitiesMonthly ?? 0,
    hoaMonthly: input.hoaMonthly ?? 0,

    // Refinance event
    refiLtvPct: input.refiLtvPct,
    refiRate: input.refiRate,
    refiTermYears: input.refiTermYears,
    refiClosingPct: input.refiClosingPct ?? 0.025,

    // Post-refi rental
    monthlyRent: input.monthlyRent,
    vacancyPct: input.vacancyPct ?? 0.05,
    maintenancePct: input.maintenancePct ?? 0.08,
    capexPct: input.capexPct ?? 0,
    pmPct: input.pmPct ?? 0.08,
    unitCount: input.unitCount ?? 1,
  };
}
