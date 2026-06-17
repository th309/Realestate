import { Injectable } from '@nestjs/common';
import { TimeSeriesService } from '../timeseries/timeseries.service';
import { ZillowService } from '../zillow/zillow.service';
import { ForecastData } from '../zillow/types';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import { MarketsService } from '../markets/markets.service';
import {
  GeoLevel as ChainGeoLevel,
  GeoChainStep,
} from '../metric-resolution/metric-resolution.types';
import { normalizeStateRegionId } from '../common/geo';
import { computeForecastBand } from './forecast-band';
import { computeAffordability, AffordabilityData } from './affordability';
import {
  buildValidationSection,
  ValidationSectionData,
} from './validation-section';

/** A single indexed line in the 12-month trajectory chart. */
export interface TrajectorySeries {
  label: string;
  /** values indexed so the first point = 100 */
  values: number[];
  /** % change across the window */
  yoy: number;
}
export interface TrajectoryData {
  series: TrajectorySeries[];
  limitedData: boolean;
}

export interface ForecastSectionData {
  historic: number[];
  forecast: number[];
  ciLow: number[];
  ciHigh: number[];
  currentValue: number;
  projectedValue: number;
  ciLow12: number;
  ciHigh12: number;
  /** Zillow's real 12-month forecast, as a percent (e.g. 3.5 = +3.5%) */
  forecast12mPct: number;
  limitedData: boolean;
}

const CHAIN_LEVELS = ['zip', 'county', 'metro', 'state', 'national'];

/** Index a raw price series so the first point = 100, and compute window YoY. */
function indexSeries(raw: number[]): { values: number[]; yoy: number } | null {
  const clean = raw.filter((v) => Number.isFinite(v) && v > 0);
  if (clean.length < 2) return null;
  const base = clean[0];
  const values = clean.map((v) => Math.round((v / base) * 1000) / 10);
  const yoy = Math.round((clean[clean.length - 1] / base - 1) * 1000) / 10;
  return { values, yoy };
}

/**
 * Builds the four data-heavy report sections (trajectory, forecast, affordability,
 * validation) for the anonymous listing presentation. Kept separate from
 * ListingPresentationService so each file stays within the size limit and the
 * data-fetching deps live in one place.
 */
@Injectable()
export class ListingPresentationSectionsService {
  constructor(
    private timeseries: TimeSeriesService,
    private zillow: ZillowService,
    private geoChain: GeographyChainService,
    private markets: MarketsService,
  ) {}

  /**
   * Fetch the market's own raw ZHVI series once (reused by trajectory + forecast).
   * 37 points = ~3 years, enough for a stable volatility estimate AND the last 12
   * for display.
   */
  async fetchMarketSeries(geoLevel: string, geoId: string): Promise<number[]> {
    const pts = await this.timeseries
      .getTimeSeries(
        'home_value',
        geoLevel,
        geoId,
        undefined,
        undefined,
        undefined,
        37,
      )
      .catch(() => []);
    return pts.map((p) => p.value).filter((v) => Number.isFinite(v) && v > 0);
  }

  async buildTrajectory(
    market: { geoLevel: string; geoId: string; name: string },
    marketSeriesRaw: number[],
  ): Promise<TrajectoryData> {
    const series: TrajectorySeries[] = [];

    // 1) the market itself — last 13 points (12-month window)
    const marketIdx = indexSeries(marketSeriesRaw.slice(-13));
    if (marketIdx) {
      series.push({
        label: market.name,
        values: marketIdx.values,
        yoy: marketIdx.yoy,
      });
    }

    // 2) comparison benchmarks: the parent metro (for county/zip) and the state
    const chain = CHAIN_LEVELS.includes(market.geoLevel)
      ? await this.geoChain
          .getInheritanceChain(market.geoLevel as ChainGeoLevel, market.geoId)
          .catch(() => [])
      : [];
    const parentMetro = chain.find(
      (c) => c.level === 'metro' && c.id !== market.geoId,
    );
    const stateStep = chain.find((c) => c.level === 'state');

    if (parentMetro) {
      const core = await this.markets
        .getMarketCore({ geoLevel: 'metro', geoId: parentMetro.id })
        .catch(() => null);
      const idx = indexSeries(
        await this.fetchComparison('metro', parentMetro.id),
      );
      if (idx) {
        series.push({
          label: core?.name ?? 'Metro area',
          values: idx.values,
          yoy: idx.yoy,
        });
      }
    }
    if (stateStep) {
      const stateName =
        normalizeStateRegionId(stateStep.id)?.stateName ?? 'State';
      const idx = indexSeries(
        await this.fetchComparison('state', stateStep.id),
      );
      if (idx) {
        series.push({ label: stateName, values: idx.values, yoy: idx.yoy });
      }
    }

    return {
      series,
      limitedData: series.length === 0 || (series[0]?.values.length ?? 0) < 2,
    };
  }

  private async fetchComparison(
    geoLevel: string,
    geoId: string,
  ): Promise<number[]> {
    const pts = await this.timeseries
      .getTimeSeries(
        'home_value',
        geoLevel,
        geoId,
        undefined,
        undefined,
        undefined,
        13,
      )
      .catch(() => []);
    return pts.map((p) => p.value).filter((v) => Number.isFinite(v) && v > 0);
  }

  async buildForecast(
    market: { geoLevel: string; geoId: string },
    marketSeriesRaw: number[],
  ): Promise<ForecastSectionData> {
    const empty: ForecastSectionData = {
      historic: [],
      forecast: [],
      ciLow: [],
      ciHigh: [],
      currentValue: 0,
      projectedValue: 0,
      ciLow12: 0,
      ciHigh12: 0,
      forecast12mPct: 0,
      limitedData: true,
    };

    const pct = await this.fetchForecastPct(market);
    if (pct == null) return empty;

    const band = computeForecastBand(marketSeriesRaw, pct);
    if (!band) return empty;

    return {
      historic: band.historic,
      forecast: band.forecast,
      ciLow: band.ciLow,
      ciHigh: band.ciHigh,
      currentValue: marketSeriesRaw[marketSeriesRaw.length - 1] ?? 0,
      projectedValue: band.projectedValue,
      ciLow12: band.ciLow12,
      ciHigh12: band.ciHigh12,
      forecast12mPct: pct,
      limitedData: false,
    };
  }

  /** Zillow ZHVF covers metros + ZIPs only. Returns the 12-month % or null. */
  private async fetchForecastPct(market: {
    geoLevel: string;
    geoId: string;
  }): Promise<number | null> {
    if (market.geoLevel === 'metro') {
      const all: ForecastData[] = await this.zillow
        .getMetroForecast('12m')
        .catch(() => []);
      const row = all.find(
        (f) => String(f.cbsa_code ?? '') === String(market.geoId),
      );
      return row && Number.isFinite(row.value) ? row.value : null;
    }
    if (market.geoLevel === 'zip') {
      const chain: GeoChainStep[] = await this.geoChain
        .getInheritanceChain('zip', market.geoId)
        .catch(() => []);
      const stateStep = chain.find((c) => c.level === 'state');
      const stateCode = stateStep
        ? normalizeStateRegionId(stateStep.id)?.stateCode
        : undefined;
      const all: ForecastData[] = await this.zillow
        .getZipForecast(stateCode, '12m')
        .catch(() => []);
      const row = all.find(
        (f) => String(f.zip_code ?? '') === String(market.geoId),
      );
      return row && Number.isFinite(row.value) ? row.value : null;
    }
    return null; // county / state / national: no forecast available
  }

  buildAffordability(metricsBatch: Record<string, unknown>): AffordabilityData {
    const v = (k: string): number | null => {
      const m = metricsBatch[k] as { value?: number | null } | undefined;
      return m && typeof m.value === 'number' ? m.value : null;
    };
    // The registry key is `median_income`; `household_income_median` is kept as a
    // defensive fallback for any caller that pre-populates that alias.
    return computeAffordability(
      v('home_value'),
      v('median_income') ?? v('household_income_median'),
      v('rent_index'),
    );
  }

  buildValidation(geoLevel: string): ValidationSectionData {
    return buildValidationSection(geoLevel);
  }
}
