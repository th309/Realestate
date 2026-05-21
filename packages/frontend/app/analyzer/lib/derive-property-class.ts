import type { PropertyClass } from "@propertyiq/analyzer-core";

/**
 * Property class derivation:
 *   - 1 unit (or sfh toggle) → "sfh", residential underwriting
 *   - 2–4 units → "small_mf", HUD/FHA residential still applies (same loan
 *     products as SFH, just totaled rent)
 *   - 5+ units → "commercial_mf", commercial underwriting (DSCR-driven,
 *     balloon term, separate amortization, cap-rate valuation)
 */
export function derivePropertyClass(
  propertyType: "sfh" | "mf",
  unitCount: number | null,
): PropertyClass {
  const units = unitCount ?? 1;
  if (propertyType === "sfh" || units <= 1) return "sfh";
  if (units <= 4) return "small_mf";
  return "commercial_mf";
}
