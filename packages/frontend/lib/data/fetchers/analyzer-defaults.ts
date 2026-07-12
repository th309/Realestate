/**
 * ANALYZER DEFAULTS FETCHERS
 *
 * Per-user analyzer assumption defaults (vacancy, maintenance, capex, etc.).
 * Stored backend-side in `user_preferences.analyzer_defaults` (JSONB).
 *
 * The `AnalyzerDefaults` type is intentionally mirrored here as a frontend-local
 * shape — the backend owner (`packages/backend/src/preferences/preferences.types.ts`)
 * is the source of truth, but we don't add a workspace dependency on backend.
 * Keep this in sync when fields are added/renamed.
 *
 * Units: all *Pct fields are decimals (0.05 === 5%). holdYears is integer years.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface AnalyzerDefaults {
  vacancyPct?: number;
  maintenancePct?: number;
  capexPct?: number;
  pmPct?: number;
  rentGrowthPct?: number;
  appreciationPct?: number;
  holdYears?: number;
  closingCostsPct?: number;
  marginalTaxRatePct?: number;
  landValueSharePct?: number;
  expenseGrowthPct?: number;
}

const DEFAULTS_URL = () => `${API_URL}/api/preferences/analyzer-defaults`;

export async function fetchAnalyzerDefaults(): Promise<AnalyzerDefaults> {
  const headers = await getAuthHeaders();
  const res = await fetch(DEFAULTS_URL(), {
    credentials: "include",
    headers: { ...headers },
  });
  if (!res.ok) throw new Error(`fetchAnalyzerDefaults ${res.status}`);
  return (await res.json()) as AnalyzerDefaults;
}

export async function updateAnalyzerDefaults(
  body: AnalyzerDefaults,
): Promise<AnalyzerDefaults> {
  const headers = await getAuthHeaders();
  const res = await fetch(DEFAULTS_URL(), {
    method: "PUT",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateAnalyzerDefaults ${res.status}`);
  return (await res.json()) as AnalyzerDefaults;
}
