/**
 * Builds the post-signup return URL for an anon capture.
 * Preserves the current map query string (geo level, state, sub-selectors —
 * see useMapViewParams URL contract) and, when a metric id is given, forces
 * it as the selected metric so the just-unlocked feature is visible on return.
 *
 * @param pathname e.g. "/map"
 * @param search   current location search incl. leading "?" (or "")
 * @param metricId clicked metric id to select, or undefined for non-metric gates
 */
export function buildAnonReturnTo(
  pathname: string,
  search: string,
  metricId: string | undefined,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (metricId) params.set("metric", metricId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
