/**
 * Pure shape adapters used by ContentDataService. These functions have no
 * I/O; they only translate payloads from the underlying services into the
 * facade's public content-data.types.ts shapes.
 */
import type { ScoreResult } from '../../scoring/scoring.types';
import {
  getScoreMomentumLabel,
  NO_SCORE_LABEL,
} from '../../scoring/score-label.util';
import type { MarketSnapshotResponse } from '../../market-snapshot/market-snapshot.service';
import { GeoRef } from '../types';
import {
  MarketSnapshot,
  PropertyIQScoreResult,
  ResolvedMarket,
} from './content-data.types';

/**
 * Placeholder PropertyIQScoreResult for geos with no score data
 * (e.g. state-level, or when the scoring service returns null).
 */
export function emptyPropertyIQScoreResult(geo: GeoRef): PropertyIQScoreResult {
  return {
    geo,
    score: 0,
    grade: 'N/A',
    label: NO_SCORE_LABEL,
    confidence_pct: 0,
    confidence_level: 'F',
    history: [],
  };
}

/**
 * Pick the external ID field that matches the format the rest of the
 * content pipeline uses for each geography level. See MEMORY.md
 * "Critical: Geography ID Formats" for the contract.
 */
export function pickResolvedId(row: {
  geography_type: string;
  geography_id: string;
  cbsa_code?: string | null;
  fips_code?: string | null;
  state_code?: string | null;
  name?: string | null;
}): string {
  switch (row.geography_type) {
    case 'state':
      return row.name ?? row.geography_id;
    case 'metro':
      return row.cbsa_code ?? row.geography_id;
    case 'county':
      return row.fips_code ?? row.geography_id;
    case 'zip':
    default:
      return row.geography_id;
  }
}

/**
 * Adapt a geographies-table row (as returned by
 * GeographyService.searchGeographies) into a ResolvedMarket.
 */
function pickLatLng(row: {
  latitude?: number | string | null;
  longitude?: number | string | null;
}): Pick<ResolvedMarket, 'latitude' | 'longitude'> {
  const lat = row.latitude != null ? Number(row.latitude) : Number.NaN;
  const lng = row.longitude != null ? Number(row.longitude) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {};
  }
  return { latitude: lat, longitude: lng };
}

export function adaptResolvedMarket(row: {
  geography_type: string;
  geography_id: string;
  name: string;
  cbsa_code?: string | null;
  fips_code?: string | null;
  state_code?: string | null;
  population?: number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): ResolvedMarket {
  return {
    geography: row.geography_type as GeoRef['geography'],
    id: pickResolvedId(row),
    canonical_name: row.name,
    state: row.state_code ?? undefined,
    population: row.population ?? undefined,
    ...pickLatLng(row),
  };
}

/**
 * Adapt MarketSnapshotResponse into the MarketSnapshot shape required by
 * the content pipeline. The snapshot service returns a wide metrics map;
 * we extract the specific metric IDs we care about and reshape them.
 *
 * `confidenceLetter` is passed in because MarketSnapshotResponse exposes
 * score + grade but not confidence_level; the caller fetches that piece
 * separately via ScoringService.
 */
export function adaptMarketSnapshot(
  geo: GeoRef,
  raw: MarketSnapshotResponse | null,
  confidenceLetter: string,
): MarketSnapshot {
  if (!raw) {
    return {
      geo,
      home_value: null,
      rent: null,
      demographics: null,
      economic: null,
      score: null,
    };
  }

  const m = raw.metrics;
  const homeValue = m['home_value'];
  const homeValueYoy = m['home_value_yoy'];
  const rent = m['rent_index'];
  const rentYoy = m['rent_yoy'];
  const population = m['population'];
  const medianIncome = m['median_income'];
  const homeownership = m['homeownership_rate'];
  const unemployment = m['unemployment_rate'];
  const jobGrowth = m['job_growth'];
  const scoreEntry = raw.scores.propertyiq;

  return {
    geo,
    home_value:
      homeValue?.value != null
        ? {
            value: homeValue.value,
            yoy_pct: homeValueYoy?.value ?? 0,
            period_date: homeValue.date ?? raw.lastUpdated,
          }
        : null,
    rent:
      rent?.value != null
        ? {
            value: rent.value,
            yoy_pct: rentYoy?.value ?? 0,
            period_date: rent.date ?? raw.lastUpdated,
          }
        : null,
    demographics:
      population?.value != null ||
      medianIncome?.value != null ||
      homeownership?.value != null
        ? {
            population: population?.value ?? 0,
            median_income: medianIncome?.value ?? 0,
            homeownership_pct: homeownership?.value ?? 0,
          }
        : null,
    economic:
      unemployment?.value != null || jobGrowth?.value != null
        ? {
            unemployment_rate: unemployment?.value ?? 0,
            job_growth_yoy_pct: jobGrowth?.value ?? 0,
          }
        : null,
    score: scoreEntry
      ? {
          propertyiq_score: scoreEntry.score,
          grade: scoreEntry.grade,
          confidence: confidenceLetter,
        }
      : null,
  };
}

/**
 * Adapt a ScoreResult (from ScoringService.getScore with historyMonths=12)
 * into the facade's PropertyIQScoreResult shape.
 */
export function adaptPropertyIQScore(
  geo: GeoRef,
  result: ScoreResult | null,
): PropertyIQScoreResult {
  const piq = result?.scores.propertyiq;
  if (!result || !piq) return emptyPropertyIQScoreResult(geo);

  const history = (piq.history?.data ?? [])
    .filter((p) => p.score != null)
    .map((p) => ({ date: p.date, score: p.score as number }));

  return {
    geo,
    score: piq.score,
    grade: piq.grade,
    label: getScoreMomentumLabel(piq.score),
    confidence_pct: piq.confidence,
    confidence_level: piq.confidence_level,
    history,
  };
}
