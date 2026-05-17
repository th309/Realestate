/**
 * F&F GRADING FETCHER — separate file from grading.ts so the B&H surface
 * stays exactly at the committed shape.
 *
 * POST /api/analyzer/grade-flip → runs gradeFixAndFlipDeal on the server,
 * returns the same DealGradingResult shape as /grade.
 */
import {
  type DealGradingResult,
  type FixAndFlipThresholds,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface FixAndFlipGradeRequest {
  strategy: "FIX_AND_FLIP";
  input: {
    strategy: "FIX_AND_FLIP";
    purchasePrice: number;
    arv: number;
    rehabCost: number;
    rehabContingencyPct?: number;
    holdMonths?: number;
    buyClosingPct?: number;
    sellingCostsPct?: number;
    financingType: "cash" | "conventional" | "hard_money" | "private";
    downPaymentPct?: number;
    loanRate?: number;
    loanTermYears?: number;
    hardMoneyPoints?: number;
    hardMoneyLtcPct?: number;
    propertyTaxAnnual: number;
    insuranceAnnual: number;
    utilitiesMonthly?: number;
    hoaMonthly?: number;
    marketGeoId?: string;
    marketZip?: string;
  };
  context?: {
    rehabVerification?: "estimate" | "contractor_bid" | "itemized_scope";
    rehabRiskAccepted?: boolean;
    arvVerification?: "estimate" | "bpo" | "appraisal" | "strict_comps";
    extendedHoldAccepted?: boolean;
    minimumNetProfit?: number;
    maxAcquisitionMultiplier?: number;
    marketDomDays?: number;
    marketPiqScore?: number;
    marketAvgRatePct?: number;
  };
  overrideThresholds?: FixAndFlipThresholds;
}

export async function fetchGradeFlipDeal(
  payload: FixAndFlipGradeRequest,
): Promise<DealGradingResult> {
  const url = `${API_URL}/api/analyzer/grade-flip`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`grade-flip ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as DealGradingResult;
}
