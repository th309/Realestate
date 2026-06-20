import type { AnonReportResponse, MarketRef, Persona } from "@/lib/data";

/**
 * Session-scoped cache for the tour finale's generated report.
 *
 * WHY: the finale report is produced by a React Query *mutation*, which is not
 * cached across component unmount/remount. Navigating Back out of the finale and
 * forward again (or any remount) re-fired the mutation, so the user watched the
 * report regenerate from scratch every time. Persisting the result keyed by
 * (persona, geoLevel-geoId) lets `Step4Aha` restore it instantly on remount.
 *
 * Storage: sessionStorage — survives in-tab Back/forward navigation but is
 * cleared when the tab closes, so a brand-new visit regenerates. Keyed by the
 * exact inputs that determine the report, so switching persona or market yields
 * a different cache entry rather than a stale one.
 */

const PREFIX = "piq_tour_report:";

function keyFor(persona: Persona, market: MarketRef): string {
  return `${PREFIX}${persona}:${market.geoLevel}-${market.geoId}`;
}

export function readReportCache(
  persona: Persona | null,
  market: MarketRef | null,
): AnonReportResponse | null {
  if (typeof sessionStorage === "undefined" || !persona || !market) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(persona, market));
    return raw ? (JSON.parse(raw) as AnonReportResponse) : null;
  } catch {
    return null;
  }
}

export function writeReportCache(
  persona: Persona | null,
  market: MarketRef | null,
  data: AnonReportResponse,
): void {
  if (typeof sessionStorage === "undefined" || !persona || !market) return;
  try {
    sessionStorage.setItem(keyFor(persona, market), JSON.stringify(data));
  } catch {
    /* quota exceeded / unavailable — non-fatal, finale just regenerates */
  }
}

/** Drop every cached finale report — used when the tour restarts fresh. */
export function clearAllReportCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* non-fatal */
  }
}
