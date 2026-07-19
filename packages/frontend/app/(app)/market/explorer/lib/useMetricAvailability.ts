import { useEffect } from "react";
import { isMetricSupportedForGeo, type GeoLevel } from "@/lib/data";
import {
  EXPLORER_METRICS,
  type ExplorerGeoLevel,
  type ExplorerMetricId,
} from "./explorer-config";
import type { SeriesByMetric } from "./explorer-math";
import type { ExplorerAction } from "./explorer-reducer";

/**
 * A fetched metric's per-region series map is still a truthy `{}` when the
 * backend query returned zero rows (e.g. Hotness Score at State scope —
 * `realtor_state` has no `hotness_score` column, so the state fetch errors
 * out to an empty row set). A plain `!series[id]` check never catches that,
 * since an empty object is truthy — it only catches the key being entirely
 * absent (e.g. before data has loaded).
 */
function hasNoFetchedData(regionSeries: Record<string, unknown> | undefined) {
  return !regionSeries || Object.keys(regionSeries).length === 0;
}

/**
 * Which metric-switcher buttons to grey out for the current scope, plus an
 * auto-correct effect so the hero chart never keeps rendering a metric this
 * scope can't actually support (e.g. arriving at State scope with
 * "PropertyIQ Score" still selected from Metro scope — greying out the
 * button alone doesn't help if the map is already showing it).
 */
export function useMetricAvailability(
  geoLevel: ExplorerGeoLevel,
  isStateScope: boolean,
  series: SeriesByMetric,
  activeMetric: ExplorerMetricId,
  dispatch: (action: ExplorerAction) => void,
): ExplorerMetricId[] {
  const disabledMetricIds = EXPLORER_METRICS.filter((m) => {
    if (m.source.kind !== "fetched") return false;
    // PIQ score has no native state-level data at all — the backend's
    // state-scope response populates `series.propertyiq_score` anyway (a
    // synthesized mean-of-metros proxy, sparse and only used internally),
    // which would otherwise defeat the hasNoFetchedData escape hatch below
    // and leave this metric wrongly selectable at state scope.
    if (m.source.series === "propertyiq_score" && isStateScope) return true;
    return (
      !isMetricSupportedForGeo(m.source.series, geoLevel as GeoLevel) &&
      hasNoFetchedData(series[m.source.series])
    );
  }).map((m) => m.id) as ExplorerMetricId[];

  useEffect(() => {
    if (!disabledMetricIds.includes(activeMetric)) return;
    const fallback = EXPLORER_METRICS.find(
      (m) => !disabledMetricIds.includes(m.id),
    );
    if (fallback) dispatch({ type: "SET_METRIC", metric: fallback.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- disabledMetricIds is a fresh array every render by design (not memoized); re-checking each render is cheap and self-stabilizes once activeMetric is valid
  }, [activeMetric, isStateScope]);

  return disabledMetricIds;
}
