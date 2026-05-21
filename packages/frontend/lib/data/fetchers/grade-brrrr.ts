/**
 * BRRRR GRADING FETCHER — separate file from grading.ts and grade-flip.ts so
 * the B&H + F&F surfaces stay at their committed shapes.
 *
 * POST /api/analyzer/grade-brrrr → runs gradeBrrrrDeal on the server,
 * returns the same DealGradingResult shape as /grade and /grade-flip.
 */
import {
  type BrrrrThresholds,
  type DealGradingResult,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface BrrrrGradeRequest {
  strategy: "BRRRR";
  input: {
    strategy: "BRRRR";
    // Acquisition
    purchasePrice: number;
    arv: number;
    rehabCost: number;
    rehabContingencyPct?: number;
    buyClosingPct?: number;
    holdMonthsBeforeRefi: number;
    // Initial financing
    initialFinancingType: "cash" | "hard_money";
    hardMoneyRate?: number;
    hardMoneyPoints?: number;
    hardMoneyLtcPct?: number;
    rehabNotFinanced?: number;
    holdingCashOutOfPocket?: number;
    interestPaidOutOfPocket?: number;
    // Property carry
    propertyTaxAnnual: number;
    insuranceAnnual: number;
    utilitiesMonthly?: number;
    hoaMonthly?: number;
    // Refinance
    refiLtvPct: number;
    refiRate: number;
    refiTermYears: 15 | 20 | 30;
    refiClosingPct?: number;
    // Post-refi rental
    monthlyRent: number;
    vacancyPct?: number;
    maintenancePct?: number;
    capexPct?: number;
    pmPct?: number;
    unitCount?: number;
    // Market identifiers
    marketGeoId?: string;
    marketZip?: string;
    marketLat?: number;
    marketLng?: number;
  };
  context?: {
    rehabVerification?: "estimate" | "contractor_bid" | "itemized_scope";
    rehabRiskAccepted?: boolean;
    arvVerification?: "estimate" | "bpo" | "appraisal" | "strict_comps";
    rentEstimateSource?: "estimate" | "rentcast" | "signed_lease";
    negativeCashFlowAccepted?: boolean;
    capitalTrappingAccepted?: boolean;
    maximumCashToLeave?: number;
    marketDomDays?: number;
    marketPiqScore?: number;
  };
  overrideThresholds?: BrrrrThresholds;
}

export async function fetchGradeBrrrrDeal(
  payload: BrrrrGradeRequest,
): Promise<DealGradingResult> {
  const url = `${API_URL}/api/analyzer/grade-brrrr`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`grade-brrrr ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as DealGradingResult;
}
