/**
 * Reports Data Fetcher — market metrics
 *
 * Fetches market metrics via MarketSnapshotService (same data feed as market
 * pages), applies MetricResolutionService fallbacks, and supplements with
 * historical calculations. Extracted from reports-data-fetcher.ts for file-size
 * compliance.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { MarketMetrics } from './reports-market-comparison';
import {
  MetricProvenance,
  MarketMetricsWithProvenance,
} from './reports-data-fetcher.types';
import { supplementHistoricalMetrics } from './reports-data-fetcher-cagr-supplement.helper';

const logger = new Logger('ReportsDataFetcher');

/**
 * Fetch market metrics using MarketSnapshotService (same data feed as market pages)
 * then supplement with historical calculations the snapshot doesn't provide.
 */
export async function fetchMarketMetrics(
  supabaseClient: SupabaseClient,
  marketSnapshotService: MarketSnapshotService,
  geographyId: string,
  geographyType: 'metro' | 'county' | 'zip',
  requiredMetrics?: string[],
  metricResolutionService?: MetricResolutionService,
): Promise<MarketMetricsWithProvenance> {
  const metrics: MarketMetrics = {};
  const provenance: Record<string, MetricProvenance> = {};

  try {
    // Use MarketSnapshotService - same data feed as market pages
    const snapshot = await marketSnapshotService.getSnapshot(
      geographyType,
      geographyId,
    );
    const sm = snapshot.metrics; // Record<string, { value, date, source, ... }>

    // Map snapshot metric IDs to MarketMetrics field names
    const v = (id: string) => sm[id]?.value ?? undefined;

    // Collect provenance from snapshot for each metric that has data.
    // Maps snapshot metric ID -> report field name for provenance tracking.
    const snapshotFieldMap: Record<string, string> = {
      home_value: 'zhvi',
      home_value_yoy: 'zhvi_yoy',
      home_price_forecast: 'zhvf_1yr_pct',
      listing_price: 'median_listing_price',
      rent_index: 'zori',
      rent_for_houses: 'zordi',
      hotness_score: 'hotness_score',
      demand_score: 'demand_score',
      supply_score: 'supply_score',
      days_on_market: 'days_on_market',
      for_sale_inventory: 'active_listing_count',
      inventory_yoy: 'inventory_yoy',
      pending_ratio: 'pending_ratio',
      price_cut_pct: 'price_reduced_share',
      sale_to_list: 'sale_to_list_ratio',
      cap_rate: 'cap_rate',
      gross_yield: 'gross_yield',
      grm: 'grm',
      overvalued_pct: 'overvalued_pct',
      rent_to_price_ratio: 'rent_to_price_ratio',
      population: 'population',
      median_income: 'median_income',
      median_age: 'median_age',
      population_growth: 'population_growth_yoy',
      unemployment_rate: 'unemployment_rate',
      job_growth: 'job_growth_yoy',
      income_growth: 'income_growth_yoy',
      homeownership_rate: 'homeownership_rate',
      home_value_5yr: 'zhvi_5y_cagr',
    };

    for (const [snapshotId, fieldName] of Object.entries(snapshotFieldMap)) {
      const entry = sm[snapshotId];
      if (entry?.value != null) {
        provenance[fieldName] = {
          source: entry.source,
          sourceGeoId: entry.sourceGeoId,
          sourceGeoLevel: entry.sourceGeoLevel,
          isInherited: entry.isInherited,
          isFallback: entry.isFallback,
        };
      }
    }

    // Price metrics
    metrics.zhvi = v('home_value');
    metrics.zhvi_yoy = v('home_value_yoy');
    metrics.zhvf_1yr_pct = v('home_price_forecast');
    metrics.median_listing_price = v('listing_price');
    metrics.median_listing_price_yoy = v('home_value_yoy');

    // Rent metrics
    metrics.zori = v('rent_index');
    metrics.zordi = v('rent_for_houses') ?? undefined;

    // Market activity
    metrics.hotness_score = v('hotness_score');
    metrics.demand_score = v('demand_score');
    metrics.supply_score = v('supply_score');
    metrics.days_on_market = v('days_on_market');
    metrics.active_listing_count = v('for_sale_inventory');
    metrics.inventory_yoy = v('inventory_yoy');
    metrics.pending_ratio = v('pending_ratio');
    metrics.price_reduced_share = v('price_cut_pct');
    metrics.sale_to_list_ratio = v('sale_to_list');

    // Investment metrics
    metrics.cap_rate = v('cap_rate');
    metrics.gross_yield = v('gross_yield');
    metrics.grm = v('grm');
    metrics.overvalued_pct = v('overvalued_pct');
    metrics.rent_to_price_ratio = v('rent_to_price_ratio');

    // Census/Economic
    metrics.population = v('population');
    metrics.median_income = v('median_income');
    metrics.median_household_income = v('median_income');
    metrics.median_age = v('median_age');
    metrics.population_growth_yoy = v('population_growth');
    metrics.unemployment_rate = v('unemployment_rate');
    metrics.job_growth_yoy = v('job_growth');
    metrics.income_growth_yoy = v('income_growth');
    metrics.homeownership_rate = v('homeownership_rate');

    // 5yr appreciation from calculated metrics
    metrics.zhvi_5y_cagr = v('home_value_5yr');

    // Fallbacks via centralized MetricResolutionService (source of truth: fallback-registry.ts)
    // home_value: Zillow ZHVI -> Census ACS -> Realtor listing price
    // rent_index: Zillow ZORI -> HUD FMR (ZIP) -> Census median_gross_rent
    // unemployment_rate: economic table with geo inheritance
    // hotness_score/demand_score: realtor with geo inheritance
    if (metricResolutionService) {
      const fallbackTargets: Array<{
        metricId: string;
        field: keyof MarketMetrics;
      }> = [];
      if (metrics.zhvi == null)
        fallbackTargets.push({ metricId: 'home_value', field: 'zhvi' });
      if (metrics.zori == null)
        fallbackTargets.push({ metricId: 'rent_index', field: 'zori' });
      if (metrics.unemployment_rate == null)
        fallbackTargets.push({
          metricId: 'unemployment_rate',
          field: 'unemployment_rate',
        });
      if (metrics.hotness_score == null)
        fallbackTargets.push({
          metricId: 'hotness_score',
          field: 'hotness_score',
        });
      if (metrics.demand_score == null)
        fallbackTargets.push({
          metricId: 'demand_score',
          field: 'demand_score',
        });
      // Inventory/activity metrics the default snapshot column maps don't emit.
      // These live in Redfin (months_of_supply, avg_sale_to_list, migration
      // net_inflow) and calculated_metrics, and were previously always null in
      // the report context — the AI then narrated them as "missing" even though
      // the data exists in the DB. Redfin is a legitimate report/display source
      // (only the PIQ score stays Redfin-free), so resolve them via the registry.
      if (metrics.months_of_supply == null)
        fallbackTargets.push({
          metricId: 'months_of_supply',
          field: 'months_of_supply',
        });
      if (metrics.sale_to_list_ratio == null)
        fallbackTargets.push({
          metricId: 'sale_to_list',
          field: 'sale_to_list_ratio',
        });
      if (metrics.net_migration == null)
        fallbackTargets.push({
          metricId: 'net_migration',
          field: 'net_migration',
        });

      if (fallbackTargets.length > 0) {
        try {
          const resolved = await metricResolutionService.resolveMetricBatch(
            fallbackTargets.map((t) => t.metricId),
            geographyType,
            geographyId,
          );
          for (const { metricId, field } of fallbackTargets) {
            const r = resolved[metricId];
            if (r?.value != null) {
              (metrics as any)[field] = r.value;
              provenance[field] = {
                source: r.source,
                sourceGeoId: r.sourceGeoId,
                sourceGeoLevel: r.sourceGeoLevel,
                isInherited: r.isInherited,
                isFallback: r.isFallback,
              };
            }
          }
        } catch (err) {
          logger.warn(
            `MetricResolution fallback failed for ${geographyType}/${geographyId}:`,
            err,
          );
        }
      }
    } else {
      // Legacy fallback when MetricResolutionService is not available
      if (metrics.zhvi == null && metrics.median_listing_price != null) {
        metrics.zhvi = metrics.median_listing_price;
      }
    }

    // Supplement with historical calculations the snapshot doesn't provide
    // (3yr/5yr ZHVI CAGR, ZORI YoY, population growth). Mutates `metrics`.
    await supplementHistoricalMetrics(
      supabaseClient,
      metrics,
      geographyType,
      geographyId,
    );

    // Create aliases for template variable names
    metrics.market_heat_index = metrics.hotness_score;
    metrics.for_sale_inventory = metrics.active_listing_count;
    metrics.days_to_pending = metrics.days_on_market;
    metrics.cap_rate_proxy = metrics.cap_rate;
    metrics.gross_rent_multiplier = metrics.grm;
    metrics.price_cut_pct = metrics.price_reduced_share;

    logger.log(
      `Fetched market metrics via snapshot for ${geographyType} ${geographyId}: ${Object.keys(metrics).filter((k) => metrics[k as keyof MarketMetrics] !== undefined).length} fields`,
    );
  } catch (error) {
    logger.error(`Failed to fetch market metrics for ${geographyId}:`, error);
  }

  return { metrics, provenance };
}
