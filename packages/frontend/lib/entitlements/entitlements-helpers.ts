/**
 * Helper constants and utilities for the EntitlementsProvider.
 * Extracted to keep EntitlementsContext.tsx under the file size limit.
 */

import type { UserTier, EntitlementsState } from "./types";
import { getAllMetricIds } from "@/lib/data";

/** Default entitlements state before any data is fetched */
export const DEFAULT_ENTITLEMENTS_STATE: EntitlementsState = {
  tier: "free",
  access: {},
  trial: null,
  loading: true,
  error: null,
};

/** Session storage keys for dev toolbar persistence */
export const STORAGE_KEYS = {
  SIMULATED_TIER: "devtools-simulated-tier",
  SIMULATED_AUTH: "devtools-simulated-auth",
} as const;

/** Valid tier values for runtime validation */
const VALID_TIERS: readonly string[] = ["free", "pro", "enterprise", "admin"];

/** Geography levels checked for entitlements */
const GEO_LEVELS = [
  "national",
  "state",
  "metro",
  "county",
  "city",
  "zip",
  "tract",
];

/** Feature slugs checked for entitlements */
const FEATURES = [
  "analytics_assistant",
  "export_csv",
  "reports",
  "ai_insights",
  "score_breakdown",
  "reports_monthly",
  "ai_analysis_monthly",
  "history_months",
  "weekly_digest",
  "benchmarking",
  "recommendations",
  "onboarding_quiz",
  "market_match",
  "personalized_dashboard",
  "markets_to_watch",
  "custom_research",
  "watchlist_limit",
];

/** Read simulated tier from sessionStorage */
export function getStoredSimulatedTier(): UserTier | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STORAGE_KEYS.SIMULATED_TIER);
  if (stored && VALID_TIERS.includes(stored)) {
    return stored as UserTier;
  }
  return null;
}

/** Read simulated auth from sessionStorage */
export function getStoredSimulatedAuth(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STORAGE_KEYS.SIMULATED_AUTH);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
}

/** Check if a string is a valid UserTier */
export function isValidTier(value: string): value is UserTier {
  return VALID_TIERS.includes(value);
}

/** Build full resource list from metric registry + geo levels + features */
export function buildResourceList(): string[] {
  return [
    ...getAllMetricIds().map((id) => `metric:${id}`),
    ...GEO_LEVELS.map((g) => `geo:${g}`),
    ...FEATURES.map((f) => `feature:${f}`),
  ];
}
