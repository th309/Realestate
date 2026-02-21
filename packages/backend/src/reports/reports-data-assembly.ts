/**
 * Reports Data Assembly
 *
 * Handles data coverage assessment and populated data assembly for the
 * report generation pipeline.  These functions evaluate which key metrics
 * are available for a given geography, look up parent geographies when
 * coverage is limited, and assemble the final `populated_data` object
 * that is persisted on the report row.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateReportDto } from './dto/generate-report.dto';

/**
 * Assess data coverage for the primary geography and look up parent
 * MSA/county when coverage is limited.
 */
export async function assessDataCoverage(
  supabase: SupabaseClient,
  marketMetrics: Record<string, any>,
  geoType: string,
  dto: GenerateReportDto,
): Promise<Record<string, any>> {
  const keyMetrics = [
    { name: 'Home Value', available: marketMetrics.zhvi != null },
    { name: 'Home Value Trend', available: marketMetrics.zhvi_yoy != null },
    { name: 'Rent', available: marketMetrics.zori != null },
    { name: 'Market Activity', available: marketMetrics.days_on_market != null || marketMetrics.active_listing_count != null },
    { name: 'Unemployment', available: marketMetrics.unemployment_rate != null },
    { name: 'Population', available: marketMetrics.population != null },
    { name: 'Hotness Score', available: marketMetrics.hotness_score != null },
    { name: 'Income', available: marketMetrics.median_income != null },
  ];
  const available = keyMetrics.filter(m => m.available).length;
  const total = keyMetrics.length;
  const missing = keyMetrics.filter(m => !m.available).map(m => m.name);
  const coverage = available / total;
  const result: Record<string, any> = {
    available,
    total,
    coverage_pct: Math.round(coverage * 100),
    is_limited: coverage < 0.75,
    missing_categories: missing,
  };

  if (result.is_limited) {
    try {
      if (geoType === 'zip') {
        const { data: xwalk } = await supabase
          .from('geography_crosswalk')
          .select('cbsa_code, cbsa_name, county_name, state_abbrev')
          .eq('zip_code', dto.primary_geography.id)
          .limit(1)
          .single();
        if (xwalk?.cbsa_name) {
          result.parent_msa_name = xwalk.cbsa_name;
          result.parent_msa_id = xwalk.cbsa_code;
        }
        if (xwalk?.county_name && xwalk?.state_abbrev) {
          result.parent_county = `${xwalk.county_name}, ${xwalk.state_abbrev}`;
        }
      } else if (geoType === 'county') {
        const { data: xwalk } = await supabase
          .from('geography_crosswalk')
          .select('cbsa_code, cbsa_name')
          .eq('county_fips', dto.primary_geography.id)
          .limit(1)
          .single();
        if (xwalk?.cbsa_name) {
          result.parent_msa_name = xwalk.cbsa_name;
          result.parent_msa_id = xwalk.cbsa_code;
        }
      }
    } catch {
      // Crosswalk lookup failed, continue without parent info
    }
  }

  return result;
}

/**
 * Assemble the populatedData object that gets stored on the report row.
 */
export function assemblePopulatedData(
  marketMetrics: Record<string, any>,
  historicalData: any,
  scores: any,
  scoreContexts: any,
  newsResult: any,
  signalSummary: any,
  comparisons: Record<string, any>,
  dataCoverage: Record<string, any>,
) {
  return {
    current: {
      zhvi: marketMetrics.zhvi,
      home_value: marketMetrics.zhvi,
      zhvi_yoy: marketMetrics.zhvi_yoy,
      home_value_yoy: marketMetrics.zhvi_yoy,
      zhvi_3y_cagr: marketMetrics.zhvi_3y_cagr,
      home_value_3y_cagr: marketMetrics.zhvi_3y_cagr,
      zhvi_5y_cagr: marketMetrics.zhvi_5y_cagr,
      home_value_5y_cagr: marketMetrics.zhvi_5y_cagr,
      zhvf_1yr_pct: marketMetrics.zhvf_1yr_pct,
      home_value_forecast_1yr: marketMetrics.zhvf_1yr_pct,
      median_listing_price: marketMetrics.median_listing_price,
      median_listing_price_yoy: marketMetrics.median_listing_price_yoy,
      zori: marketMetrics.zori,
      median_rent: marketMetrics.zori,
      zori_yoy: marketMetrics.zori_yoy,
      rent_yoy: marketMetrics.zori_yoy,
      zori_5y_cagr: marketMetrics.zori_5y_cagr,
      rent_5y_cagr: marketMetrics.zori_5y_cagr,
      zordi: marketMetrics.zordi,
      rental_demand_index: marketMetrics.zordi,
      days_on_market: marketMetrics.days_on_market,
      active_listing_count: marketMetrics.active_listing_count,
      inventory_yoy: marketMetrics.inventory_yoy,
      hotness_score: marketMetrics.hotness_score,
      demand_score: marketMetrics.demand_score,
      supply_score: marketMetrics.supply_score,
      pending_ratio: marketMetrics.pending_ratio,
      price_reduced_share: marketMetrics.price_reduced_share,
      cap_rate: marketMetrics.cap_rate,
      gross_yield: marketMetrics.gross_yield,
      grm: marketMetrics.grm,
      overvalued_pct: marketMetrics.overvalued_pct,
      median_income: marketMetrics.median_income,
      median_household_income: marketMetrics.median_household_income,
      median_age: marketMetrics.median_age,
      population: marketMetrics.population,
      population_growth_yoy: marketMetrics.population_growth_yoy,
      unemployment_rate: marketMetrics.unemployment_rate,
      job_growth_yoy: marketMetrics.job_growth_yoy,
      rent_to_price_ratio: marketMetrics.rent_to_price_ratio,
      affordability_index: marketMetrics.affordability_index,
      income_growth_yoy: marketMetrics.income_growth_yoy,
    },
    data_coverage: dataCoverage,
    historical: historicalData,
    benchmarks: {},
    scores: {
      homeready: scores
        ? {
            score: scores.scores.homeready.score,
            grade: scores.scores.homeready.grade,
            trend: 'stable',
            context: scoreContexts?.homeready || undefined,
            components: scores.scores.homeready.components || undefined,
          }
        : undefined,
      investoredge: scores
        ? {
            score: scores.scores.investoredge.score,
            grade: scores.scores.investoredge.grade,
            trend: 'stable',
            context: scoreContexts?.investoredge || undefined,
            components: scores.scores.investoredge.components || undefined,
          }
        : undefined,
      markethealth: scores
        ? {
            score: scores.scores.markethealth.score,
            grade: scores.scores.markethealth.grade,
            trend: 'stable',
            context: scoreContexts?.markethealth || undefined,
            components: scores.scores.markethealth.components || undefined,
          }
        : undefined,
    },
    realtime: newsResult
      ? {
          news: newsResult.local_news,
          indicators: newsResult.economic_indicators,
          signals: newsResult.market_signals,
          national_context: newsResult.national_context,
          signal_summary: signalSummary,
          fetched_at: newsResult.scout_metadata.search_timestamp,
        }
      : null,
    comparisons: Object.keys(comparisons).length > 0 ? comparisons : undefined,
  };
}
