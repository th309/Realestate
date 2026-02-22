import type { GeoLevel } from './types';
import { METRICS } from './registry';
import { formatDataDateForDisplay } from './registry-helpers';
import type { DataFreshnessResponse, FreshnessEconomicMetric, FreshnessGeoLevel } from './fetchers/freshness';

function toFreshnessGeoLevel(geoLevel?: GeoLevel | null): FreshnessGeoLevel | null {
  if (!geoLevel || geoLevel === 'tract') return null;
  return geoLevel;
}

function pickMostRecentRaw(values: Array<string | null | undefined>): string | null {
  let best: { raw: string; ts: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const ts = dateSortValue(value);
    if (ts == null) continue;
    if (!best || ts > best.ts) best = { raw: value, ts };
  }
  return best?.raw ?? null;
}

function dateSortValue(value: string): number | null {
  if (/^\d{4}$/.test(value)) return Date.UTC(Number(value), 0, 1);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function getSupportedFreshnessGeos(metricId: string): FreshnessGeoLevel[] {
  const config = METRICS[metricId];
  if (!config) return [];
  return config.supportedGeos.map(toFreshnessGeoLevel).filter((geo): geo is FreshnessGeoLevel => !!geo);
}

function pickTableDateForMetric(
  metricId: string,
  data: DataFreshnessResponse,
  prefix: string,
  geoLevel?: GeoLevel | null,
  options?: { nationalUsesState?: boolean },
): string | null {
  const requestedGeo = toFreshnessGeoLevel(geoLevel);
  if (requestedGeo) {
    if (requestedGeo === 'national' && options?.nationalUsesState) {
      return data.tableDates[`${prefix}_state`] ?? null;
    }
    return data.tableDates[`${prefix}_${requestedGeo}`] ?? null;
  }

  const candidates = getSupportedFreshnessGeos(metricId).map((geo) => {
    const tableGeo = geo === 'national' && options?.nationalUsesState ? 'state' : geo;
    return data.tableDates[`${prefix}_${tableGeo}`] ?? null;
  });
  return pickMostRecentRaw(candidates);
}

function resolveEconomicMetric(endpoint: string): FreshnessEconomicMetric | null {
  if (endpoint.startsWith('/api/economic/unemployment/')) return 'unemployment_rate';
  if (endpoint.startsWith('/api/economic/job-growth/')) return 'employment_yoy';
  if (endpoint.startsWith('/api/economic/gdp-growth/')) return 'gdp_yoy';
  if (endpoint.startsWith('/api/economic/cost-of-living/')) return 'rpp_all_items';
  return null;
}

function pickEconomicDate(
  metricKey: FreshnessEconomicMetric,
  data: DataFreshnessResponse,
  metricId: string,
  geoLevel?: GeoLevel | null,
): string | null {
  const byGeo = data.economicMetricDates[metricKey];
  const requestedGeo = toFreshnessGeoLevel(geoLevel);
  if (requestedGeo) return byGeo?.[requestedGeo] ?? null;

  const candidates = getSupportedFreshnessGeos(metricId).map((geo) => byGeo?.[geo] ?? null);
  return pickMostRecentRaw(candidates);
}

function pickSourceFallback(metricId: string, data: DataFreshnessResponse): string | null {
  const config = METRICS[metricId];
  if (!config) return null;

  switch (config.dataSource) {
    case 'fred':
      return data.sourceDates.economic ?? null;
    case 'propertyiq':
      return data.sourceDates.propertyiq ?? data.tableDates.propertyiq_scores ?? null;
    case 'calculated':
      return data.sourceDates.calculated ?? data.tableDates.calculated_metrics ?? null;
    default:
      return data.sourceDates[config.dataSource] ?? null;
  }
}

export function resolveMetricFreshnessDate(
  metricId: string,
  data?: DataFreshnessResponse | null,
  geoLevel?: GeoLevel | null,
): string | null {
  if (!data) return null;
  const config = METRICS[metricId];
  if (!config) return null;

  const endpoint = config.apiEndpoint;
  const requestedGeo = toFreshnessGeoLevel(geoLevel);

  const economicMetric = resolveEconomicMetric(endpoint);
  if (economicMetric) {
    return pickEconomicDate(economicMetric, data, metricId, geoLevel) ?? pickSourceFallback(metricId, data);
  }

  if (endpoint.startsWith('/api/census/')) {
    return pickTableDateForMetric(metricId, data, 'census', geoLevel) ?? data.sourceDates.census_acs ?? pickSourceFallback(metricId, data);
  }

  if (endpoint.startsWith('/api/permits/')) {
    return pickTableDateForMetric(metricId, data, 'permits', geoLevel, { nationalUsesState: true }) ?? data.sourceDates.permits ?? data.sourceDates.census ?? null;
  }

  if (endpoint.startsWith('/api/zillow/forecast/')) {
    if (requestedGeo && requestedGeo !== 'national') {
      return data.zillowDates.forecastByGeo[requestedGeo] ?? data.sourceDates.zillow_forecast ?? null;
    }
    return pickMostRecentRaw(
      getSupportedFreshnessGeos(metricId)
        .filter((geo) => geo !== 'national')
        .map((geo) => data.zillowDates.forecastByGeo[geo] ?? null),
    ) ?? data.sourceDates.zillow_forecast ?? null;
  }

  if (endpoint.startsWith('/api/zillow/')) {
    if (requestedGeo && requestedGeo !== 'national') {
      return data.zillowDates.historicalByGeo[requestedGeo as Exclude<FreshnessGeoLevel, 'national'>] ?? data.sourceDates.zillow ?? null;
    }
    return pickMostRecentRaw(
      getSupportedFreshnessGeos(metricId)
        .filter((geo) => geo !== 'national')
        .map((geo) => data.zillowDates.historicalByGeo[geo as Exclude<FreshnessGeoLevel, 'national'>] ?? null),
    ) ?? data.sourceDates.zillow ?? null;
  }

  if (endpoint.startsWith('/api/realtor/')) {
    return pickTableDateForMetric(metricId, data, 'realtor', geoLevel) ?? data.sourceDates.realtor ?? null;
  }

  if (endpoint.startsWith('/api/scores/')) {
    return data.tableDates.propertyiq_scores ?? data.sourceDates.propertyiq ?? null;
  }

  if (endpoint.startsWith('/api/metrics/')) {
    if (config.dataSource === 'calculated') return data.tableDates.calculated_metrics ?? data.sourceDates.calculated ?? null;
    if (config.dataSource === 'realtor') return data.sourceDates.realtor ?? null;
    if (config.dataSource === 'zillow') return data.sourceDates.zillow ?? null;
    if (config.dataSource === 'census') return data.sourceDates.census ?? null;
    if (config.dataSource === 'fred') return data.sourceDates.economic ?? null;
    if (config.dataSource === 'propertyiq') return data.sourceDates.propertyiq ?? null;
  }

  return pickSourceFallback(metricId, data);
}

export function formatMetricFreshnessDate(
  metricId: string,
  data?: DataFreshnessResponse | null,
  geoLevel?: GeoLevel | null,
): string {
  const rawDate = resolveMetricFreshnessDate(metricId, data, geoLevel);
  return rawDate ? formatDataDateForDisplay(rawDate) : '';
}

