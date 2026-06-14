/**
 * Fetcher for the address-driven prefill bundle (GET /api/analyzer/prefill).
 * Types mirror the backend AnalyzerPrefillDto. Auth headers are sent when
 * available so Pro callers get the parcel layer; anonymous calls still work.
 */
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export type PrefillConfidenceGrade = "a" | "b" | "c" | "f";

export type PrefillFieldKey =
  | "price"
  | "rentMonthly"
  | "taxAnnual"
  | "insuranceAnnual"
  | "hoaMonthly"
  | "vacancyPctOfRent"
  | "appreciationPct"
  | "rentGrowthPct";

export interface PrefillField {
  value: number | null;
  source: string | null;
  asOf: string | null;
  confidence: { grade: PrefillConfidenceGrade; pct: number };
  kind: "data" | "estimate";
  geoLevel: "parcel" | "zip" | "county" | "metro" | "state" | null;
  inherited: boolean;
}

export interface AnalyzerPrefillBundle {
  resolvedAddress: string | null;
  geo: {
    zip: string | null;
    countyFips: string | null;
    cbsaCode: string | null;
    state: string | null;
  };
  hasParcelData: boolean;
  fields: Record<PrefillFieldKey, PrefillField>;
  notes: string[];
}

export interface AnalyzerPrefillParams {
  zip?: string;
  address?: string;
}

export async function fetchAnalyzerPrefill(
  params: AnalyzerPrefillParams,
): Promise<AnalyzerPrefillBundle | null> {
  const qs = new URLSearchParams();
  if (params.zip) qs.set("zip", params.zip);
  if (params.address) qs.set("address", params.address);

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/prefill?${qs}`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return null;
  return res.json();
}
