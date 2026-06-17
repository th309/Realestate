/**
 * Shared, defensive extractors for the listing-presentation adapter layer.
 *
 * The backend section `data` shapes are loosely typed (`unknown`); these helpers
 * pull finite numbers / strings / arrays out safely so a malformed or empty
 * section degrades to `limitedData` instead of throwing. Used by both
 * `adapt-sections.ts` (per-section props) and `adapt-hero.ts` (the hero bundle).
 */

export function asRecord(d: unknown): Record<string, unknown> {
  return d && typeof d === "object" && !Array.isArray(d)
    ? (d as Record<string, unknown>)
    : {};
}

export function asArray(d: unknown): unknown[] {
  return Array.isArray(d) ? d : [];
}

/** A finite number from a raw value or a `{ value }` wrapper, else null. */
export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (
    v &&
    typeof v === "object" &&
    typeof (v as { value?: unknown }).value === "number"
  ) {
    const n = (v as { value: number }).value;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function numArray(v: unknown): number[] {
  return asArray(v)
    .map((n) => num(n))
    .filter((n): n is number => n != null);
}

export function splitParagraphs(t: unknown): string[] {
  if (typeof t !== "string" || !t.trim()) return [];
  return t
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Compact USD: $468K / $1.23M. */
export function formatUsdK(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}K`;
}

/** Confidence % → A/B/C/F letter (CLAUDE.md §9 thresholds). */
export function confidenceLetter(pct: number): "A" | "B" | "C" | "F" {
  if (pct >= 80) return "A";
  if (pct >= 65) return "B";
  if (pct >= 45) return "C";
  return "F";
}

/** PropertyIQ score number out of a raw ScoreResult (tolerates flat `{score}`). */
export function scoreNumber(raw: unknown): number | null {
  const r = asRecord(raw);
  const flat = num(r.score);
  if (flat != null) return flat;
  const piq = asRecord(asRecord(r.scores).propertyiq);
  return num(piq.score);
}

export function scoreConfidencePct(raw: unknown): number {
  const r = asRecord(raw);
  const piq = asRecord(asRecord(r.scores).propertyiq);
  const c = num(piq.confidence) ?? num(r.confidence);
  if (c == null) return 70; // sensible default when the source omits confidence
  return Math.round(c <= 1 ? c * 100 : c);
}
