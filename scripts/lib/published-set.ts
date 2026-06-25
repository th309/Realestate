// scripts/lib/published-set.ts
// Pure window math for score-gated SEO page generation. No I/O.

export const PUBLISH_WINDOW_MONTHS = 2;
export const REDIRECT_LOOKBACK_MONTHS = 6;

/** Split newest-first periods into the publish window and the (larger) redirect lookback. */
export function pickWindows(periods: string[]): {
  publish: string[];
  lookback: string[];
} {
  return {
    publish: periods.slice(0, PUBLISH_WINDOW_MONTHS),
    lookback: periods.slice(0, REDIRECT_LOOKBACK_MONTHS),
  };
}

function unionOver(
  byPeriod: Map<string, Set<string>>,
  periods: string[],
): Set<string> {
  const out = new Set<string>();
  for (const p of periods) for (const id of byPeriod.get(p) ?? []) out.add(id);
  return out;
}

/** A geo is published if scored in ANY publish-window month (grace within the window). */
export function computePublishedIds(
  byPeriod: Map<string, Set<string>>,
  publishPeriods: string[],
): Set<string> {
  return unionOver(byPeriod, publishPeriods);
}

/** Redirect candidates = scored within lookback but not currently published. */
export function computeRedirectIds(
  byPeriod: Map<string, Set<string>>,
  publishPeriods: string[],
  lookbackPeriods: string[],
): Set<string> {
  const published = computePublishedIds(byPeriod, publishPeriods);
  const recent = unionOver(byPeriod, lookbackPeriods);
  const out = new Set<string>();
  for (const id of recent) if (!published.has(id)) out.add(id);
  return out;
}

/** Fail-closed guard: a never-empty publish set is required to overwrite a slug JSON. */
export function assertNonEmpty(label: string, ids: Set<string>): void {
  if (ids.size === 0) {
    throw new Error(
      `fail-closed: refusing to regenerate ${label} slug data from an empty published set`,
    );
  }
}

/** Keys used to walk the ancestor hierarchy for a geo that lost its score. */
export interface AncestorKeys {
  countyFips?: string | null;
  cbsaCode?: string | null;
  state: string;
}

/**
 * Given a de-scored geo entry, return the nearest published ancestor path.
 * Priority: county page → metro page → state page → null.
 * County entries pass `countyFips: undefined`; metro entries pass both undefined.
 */
export function resolveAncestorRedirect(
  entry: AncestorKeys,
  publishedCountySlugByFips: Map<string, string>,
  publishedMetroSlugByCbsa: Map<string, string>,
  stateSlugOf: (state: string) => string,
): string | null {
  if (entry.countyFips && publishedCountySlugByFips.has(entry.countyFips)) {
    return `/markets/county/${publishedCountySlugByFips.get(entry.countyFips)}`;
  }
  if (entry.cbsaCode && publishedMetroSlugByCbsa.has(entry.cbsaCode)) {
    return `/markets/${publishedMetroSlugByCbsa.get(entry.cbsaCode)}`;
  }
  if (entry.state) return `/markets/state/${stateSlugOf(entry.state)}`;
  return null;
}
