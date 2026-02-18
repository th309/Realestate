import { Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeStateToCode } from '../common/geo';
import { normalizeZipKey } from '../common/zip';
import { CalculatedMetricsService } from './calculated-metrics.service';

// Updated 2026-01-19: Cap rate data validation fix

// National median household income benchmark (approximate 2024 value)
const NATIONAL_MEDIAN_INCOME = 75000;
// Traditional price-to-income affordability benchmark
const PRICE_TO_INCOME_BENCHMARK = 3.5;

@Controller('api/metrics')
export class MetricsController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) { }

  /**
   * Get overvalued percentage for metros
   * Calculated as: ((ZHVI / median_income) - 3.5) / 3.5 * 100
   * Uses pre-calculated data from calculated_metrics when available; otherwise
   * computes from zillow_metro (long-format) ZHVI and Census median income.
   */
  @Get('overvalued/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroOvervalued(@Query('date') date?: string) {
    // Try pre-calculated data first (same pattern as cap rate)
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'overvalued_pct',
        'metro',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'overvalued_pct',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fallback: compute on-the-fly from zillow_metro (long-format)
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('zillow_metro')
        .select('period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No ZHVI data available', data: [] };
    }

    const { data: zhviData, error: zhviError } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, value, cbsa_code')
      .eq('metric_name', 'zhvi')
      .eq('period_date', targetDate)
      .not('value', 'is', null);

    if (zhviError || !zhviData) {
      return {
        success: false,
        error: zhviError?.message || 'Failed to fetch ZHVI data',
        data: [],
      };
    }

    const { data: incomeData } = await this.supabase
      .from('census_data')
      .select('geography_id, value')
      .eq('geography_type', 'metro')
      .eq('metric_name', 'median_income')
      .order('year', { ascending: false });

    const incomeByGeo: Record<string, number> = {};
    if (incomeData) {
      for (const row of incomeData) {
        if (row.value && !incomeByGeo[row.geography_id]) {
          incomeByGeo[row.geography_id] = Number(row.value);
        }
      }
    }

    const results = zhviData.map((metro) => {
      const zhvi = metro.value;
      const cbsaCode = metro.cbsa_code;
      const medianIncome =
        (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;
      const priceToIncome = zhvi / medianIncome;
      const overvaluedPct =
        ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) /
          PRICE_TO_INCOME_BENCHMARK) *
        100;

      return {
        region_id: metro.region_id,
        region_name: metro.region_name,
        cbsa_code: cbsaCode,
        zhvi,
        median_income: medianIncome,
        price_to_income: Math.round(priceToIncome * 100) / 100,
        overvalued_pct: Math.round(overvaluedPct * 10) / 10,
      };
    });

    return {
      success: true,
      count: results.length,
      geography: 'Metro',
      metric: 'overvalued_pct',
      benchmark: {
        price_to_income_ratio: PRICE_TO_INCOME_BENCHMARK,
        national_median_income: NATIONAL_MEDIAN_INCOME,
      },
      data: results,
    };
  }

  /**
   * Get cap rate proxy for metros
   * Calculated as: (ZORI * 12 * 0.6) / ZHVI * 100
   */
  @Get('cap-rate/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroCapRate(@Query('date') date?: string) {
    // Try pre-calculated data first
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'cap_rate',
        'metro',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'cap_rate',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fallback to on-the-fly calculation
    // Get latest date from ZORI data
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('zillow_zori')
        .select('date')
        .eq('geography', 'Metro')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.date;
    }

    if (!targetDate) {
      return { success: false, error: 'No ZORI data available', data: [] };
    }

    // Get ZORI (rent) data
    const { data: zoriData, error: zoriError } = await this.supabase
      .from('zillow_zori')
      .select('region_id, region_name, value, cbsa_code')
      .eq('geography', 'Metro')
      .eq('date', targetDate)
      .not('value', 'is', null);

    if (zoriError || !zoriData) {
      return {
        success: false,
        error: zoriError?.message || 'Failed to fetch ZORI data',
        data: [],
      };
    }

    // Get ZHVI data for the same metros
    const { data: zhviData } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value')
      .eq('geography', 'Metro')
      .eq('date', targetDate)
      .not('value', 'is', null);

    // Create ZHVI lookup
    const zhviByRegion: Record<string, number> = {};
    if (zhviData) {
      for (const row of zhviData) {
        zhviByRegion[row.region_id] = row.value;
      }
    }

    // Calculate cap rate for each metro
    const EXPENSE_RATIO = 0.6; // NOI ratio
    const zoriCbsas = new Set<string>();
    const results = zoriData
      .filter((metro) => zhviByRegion[metro.region_id])
      .map((metro) => {
        const zori = metro.value;
        const zhvi = zhviByRegion[metro.region_id];
        const capRate = ((zori * 12 * EXPENSE_RATIO) / zhvi) * 100;
        if (metro.cbsa_code) zoriCbsas.add(metro.cbsa_code);

        return {
          region_id: metro.region_id,
          region_name: metro.region_name,
          cbsa_code: metro.cbsa_code,
          zori,
          zhvi,
          cap_rate: Math.round(capRate * 100) / 100,
        };
      });

    // ── HUD FMR fallback for metros with ZHVI but no ZORI ──
    // Get ZHVI metros from long-format table to find CBSAs without ZORI
    const { data: zhviMetroRows } = await this.supabase
      .from('zillow_metro')
      .select('cbsa_code, value, region_name')
      .eq('metric_name', 'zhvi')
      .eq('period_date', targetDate)
      .not('value', 'is', null)
      .not('cbsa_code', 'is', null);

    if (zhviMetroRows && zhviMetroRows.length > 0) {
      const cbsasWithZhviOnly = zhviMetroRows.filter(
        (r) => r.cbsa_code && !zoriCbsas.has(r.cbsa_code),
      );

      if (cbsasWithZhviOnly.length > 0) {
        const cbsaCodes = cbsasWithZhviOnly.map((r) => r.cbsa_code!);
        const targetYear = parseInt(targetDate!.substring(0, 4));

        // Map CBSA → ZHVI price & name
        const priceByCode: Record<string, number> = {};
        const nameByCode: Record<string, string> = {};
        for (const row of cbsasWithZhviOnly) {
          priceByCode[row.cbsa_code!] = row.value;
          nameByCode[row.cbsa_code!] = row.region_name || `Metro ${row.cbsa_code}`;
        }

        // Get component counties
        const { data: countyRows } = await this.supabase
          .from('geographies')
          .select('cbsa_code, fips_code, population')
          .eq('geography_type', 'county')
          .in('cbsa_code', cbsaCodes)
          .not('fips_code', 'is', null);

        if (countyRows && countyRows.length > 0) {
          // Group counties by CBSA
          const countiesByCbsa: Record<string, Array<{ fips: string; population: number | null }>> = {};
          for (const c of countyRows) {
            if (!c.cbsa_code || !c.fips_code) continue;
            if (!countiesByCbsa[c.cbsa_code]) countiesByCbsa[c.cbsa_code] = [];
            countiesByCbsa[c.cbsa_code].push({
              fips: String(parseInt(c.fips_code, 10)).padStart(5, '0'),
              population: c.population,
            });
          }

          // Fetch HUD FMR
          const allFips = countyRows
            .map((c) => c.fips_code ? String(parseInt(c.fips_code, 10)).padStart(5, '0') : null)
            .filter(Boolean) as string[];

          const { data: fmrRows } = await this.supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', targetYear)
            .in('fips_code', allFips)
            .not('fmr_2br', 'is', null);

          if (fmrRows && fmrRows.length > 0) {
            const fmrByFips: Record<string, number> = {};
            for (const r of fmrRows) {
              const fips = r.fips_code && /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
              if (fips && r.fmr_2br != null) fmrByFips[fips] = r.fmr_2br;
            }

            // Compute population-weighted FMR for each metro
            for (const cbsa of cbsaCodes) {
              const counties = countiesByCbsa[cbsa];
              if (!counties || counties.length === 0) continue;

              let totalRent = 0;
              let totalWeight = 0;
              for (const county of counties) {
                const fmr = fmrByFips[county.fips];
                if (fmr == null || fmr <= 0) continue;
                const weight = county.population ?? 1;
                totalRent += fmr * weight;
                totalWeight += weight;
              }

              if (totalWeight === 0) continue;
              const avgRent = totalRent / totalWeight;
              const price = priceByCode[cbsa];
              if (!price) continue;

              const capRate = ((avgRent * 12 * EXPENSE_RATIO) / price) * 100;
              results.push({
                region_id: cbsa,
                region_name: nameByCode[cbsa] || `Metro ${cbsa}`,
                cbsa_code: cbsa,
                zori: avgRent,
                zhvi: price,
                cap_rate: Math.round(capRate * 100) / 100,
              });
            }
          }
        }
      }
    }

    return {
      success: true,
      count: results.length,
      geography: 'Metro',
      metric: 'cap_rate',
      data: results,
    };
  }

  /**
   * Get cap rate for counties
   */
  @Get('cap-rate/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyCapRate() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'cap_rate',
        'county',
      );

    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'cap_rate',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error:
        'No calculated Cap Rate data available for counties. Run batch calculation.',
      data: [],
    };
  }

  /**
   * Get cap rate for zip codes
   */
  @Get('cap-rate/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipCapRate() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'cap_rate',
        'zip',
      );

    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Zip',
        metric: 'cap_rate',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error:
        'No calculated Cap Rate data available for ZIPs. Run batch calculation.',
      data: [],
    };
  }

  // ============================================================================
  // RENTER DEMAND INDEX (calculated stand-in for Zillow ZORDI)
  // ============================================================================

  @Get('renter-demand/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRenterDemand() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'metro',
      );
    return {
      success: preCalculated.success,
      count: preCalculated.data.length,
      geography: 'Metro',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data: preCalculated.data,
    };
  }

  @Get('renter-demand/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyRenterDemand() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'county',
      );
    return {
      success: preCalculated.success,
      count: preCalculated.data.length,
      geography: 'County',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data: preCalculated.data,
    };
  }

  @Get('renter-demand/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipRenterDemand(@Query('state') state?: string) {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'zip',
      );
    // Filter by state if provided
    let data = preCalculated.data;
    if (state && preCalculated.data.length > 0) {
      const stateCode = normalizeStateToCode(state).toUpperCase();
      data = preCalculated.data.filter(
        (d: any) => d.state_code?.toUpperCase() === stateCode,
      );
    }
    return {
      success: preCalculated.success,
      count: data.length,
      geography: 'Zip',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data,
    };
  }

  // ============================================================================
  // INVESTMENT METRICS ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get gross yield for metros (from pre-calculated data, with fallback)
   */
  @Get('gross-yield/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroGrossYield() {
    // Try pre-calculated data first
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'gross_yield',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'gross_yield',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation (similar to cap-rate endpoint)
    return this.getMetroCapRate(); // Uses same data sources
  }

  @Get('gross-yield/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyGrossYield() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('gross_yield', 'county');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'County', metric: 'gross_yield', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No Gross Yield data available for counties. Run batch calculation.', data: [] };
  }

  @Get('gross-yield/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipGrossYield() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('gross_yield', 'zip');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'Zip', metric: 'gross_yield', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No Gross Yield data available for ZIPs. Run batch calculation.', data: [] };
  }

  /**
   * Get GRM (Gross Rent Multiplier) for metros
   */
  @Get('grm/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('grm');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'grm',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error: 'No GRM data available. Run batch calculation first.',
      data: [],
    };
  }

  @Get('grm/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('grm', 'county');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'County', metric: 'grm', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No GRM data available for counties. Run batch calculation.', data: [] };
  }

  @Get('grm/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('grm', 'zip');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'Zip', metric: 'grm', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No GRM data available for ZIPs. Run batch calculation.', data: [] };
  }

  /**
   * Rent-to-Price Ratio endpoints
   */
  @Get('rent-to-price/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('rent_to_price_ratio');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'Metro', metric: 'rent_to_price_ratio', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No Rent-to-Price data available. Run batch calculation.', data: [] };
  }

  @Get('rent-to-price/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('rent_to_price_ratio', 'county');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'County', metric: 'rent_to_price_ratio', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No Rent-to-Price data available for counties. Run batch calculation.', data: [] };
  }

  @Get('rent-to-price/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('rent_to_price_ratio', 'zip');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return { success: true, count: preCalculated.data.length, geography: 'Zip', metric: 'rent_to_price_ratio', source: 'pre-calculated', data: preCalculated.data };
    }
    return { success: false, error: 'No Rent-to-Price data available for ZIPs. Run batch calculation.', data: [] };
  }

  /**
   * Get all investment metrics for a specific metro
   */
  @Get('investment/:geoType/:geoId')
  @Header('Cache-Control', 'public, max-age=21600')
  async getInvestmentMetrics(
    @Param('geoType') geoType: string,
    @Param('geoId') geoId: string,
  ) {
    const metrics = await this.calculatedMetricsService.getMetrics(
      geoId,
      geoType,
    );

    if (!metrics) {
      return {
        success: false,
        error: 'No calculated metrics found for this geography',
        data: null,
      };
    }

    return {
      success: true,
      geography_type: geoType,
      geography_id: geoId,
      data: {
        cap_rate: metrics.cap_rate,
        gross_yield: metrics.gross_yield,
        rent_to_price_ratio: metrics.rent_to_price_ratio,
        grm: metrics.grm,
        overvalued_pct: metrics.overvalued_pct,
        months_of_supply: metrics.months_of_supply,
        absorption_rate: metrics.absorption_rate,
      },
    };
  }

  // ============================================================================
  // BATCH CALCULATION ENDPOINTS
  // ============================================================================

  /**
   * Trigger batch calculation of investment metrics for all metros
   * Should be called monthly after new data is imported
   */
  @Post('calculate-investment-metrics')
  async calculateInvestmentMetricsBatch(@Query('year') year?: number) {
    const results =
      await this.calculatedMetricsService.calculateAllInvestmentMetrics(year);
    return {
      success: true,
      message: 'Investment metrics batch calculation completed',
      results,
      totals: {
        processed:
          results.investmentMetrics.processed + results.overvalued.processed,
        stored: results.investmentMetrics.stored + results.overvalued.stored,
      },
    };
  }

  /**
   * Trigger batch calculation of 5-year growth for all geographies
   * Should be called monthly after new data is imported
   */
  /**
   * Trigger batch calculation of 5-year growth for all geographies
   * Should be called monthly after new data is imported
   */
  @Post('calculate-5yr-growth')
  async calculate5YrGrowthBatch(@Query('year') year?: number) {
    const results =
      await this.calculatedMetricsService.calculate5YrGrowthForAll(year);
    return {
      success: true,
      message: 'Batch calculation completed',
      results: {
        metros: results.metros,
        states: results.states,
        counties: results.counties,
        zips: results.zips,
        national: results.national,
      },
      totals: {
        processed:
          results.metros.processed +
          results.states.processed +
          results.counties.processed +
          results.zips.processed +
          results.national.processed,
        stored:
          results.metros.stored +
          results.states.stored +
          results.counties.stored +
          results.zips.stored +
          results.national.stored,
      },
    };
  }

  /**
   * Trigger batch calculation for a specific geography type
   */
  @Post('calculate-5yr-growth/:geoType')
  async calculate5YrGrowthByGeo(
    @Param('geoType') geoType: string,
    @Query('year') year?: number,
  ) {
    let result: { processed: number; stored: number };

    switch (geoType) {
      case 'metros':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForMetros(year);
        break;
      case 'states':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForStates(year);
        break;
      case 'counties':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForCounties();
        break;
      case 'zips':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForZips();
        break;
      case 'national':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForNational(
            year,
          );
        break;
      default:
        return { success: false, error: `Invalid geography type: ${geoType}` };
    }

    return {
      success: true,
      geography: geoType,
      ...result,
    };
  }

  // ============================================================================
  // 5-YEAR GROWTH API ENDPOINTS (with pre-calculated fallback)
  // ============================================================================

  /**
   * Get 5-year home value CAGR for metros
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroHomeValue5YrGrowth(@Query('date') date?: string) {
    const result = await this.calculatedMetricsService.get5YrGrowthForMap('metro');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No pre-calculated CAGR data available for metros. Run the calculated metrics pipeline to generate data.',
        geography: 'Metro',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'Metro',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for national
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalHomeValue5YrGrowth(@Query('date') date?: string) {
    const result = await this.calculatedMetricsService.get5YrGrowthForMap('national');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No pre-calculated CAGR data available for national. Run the calculated metrics pipeline to generate data.',
        geography: 'National',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'National',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for states
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateHomeValue5YrGrowth(@Query('date') date?: string) {
    const result = await this.calculatedMetricsService.get5YrGrowthForMap('state');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No pre-calculated CAGR data available for states. Run the calculated metrics pipeline to generate data.',
        geography: 'State',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'State',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for counties
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyHomeValue5YrGrowth(@Query('date') date?: string) {
    const result = await this.calculatedMetricsService.get5YrGrowthForMap('county');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No pre-calculated CAGR data available for counties. Run the calculated metrics pipeline to generate data.',
        geography: 'County',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'County',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for zip codes
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   * Note: State filtering should be done via the data layer or a dedicated filtered endpoint
   */
  @Get('home-value-5yr/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipHomeValue5YrGrowth(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const result = await this.calculatedMetricsService.get5YrGrowthForMap('zip');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No pre-calculated CAGR data available for ZIP codes. Run the calculated metrics pipeline to generate data.',
        geography: 'ZIP',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    // Apply state filter if provided (filter pre-calculated data)
    let filteredData = result.data;
    if (state) {
      const normalizedState = normalizeStateToCode(state);
      const statePattern = `, ${normalizedState.toUpperCase()}`;
      filteredData = result.data.filter((item: any) =>
        item.region_name?.toUpperCase().endsWith(statePattern)
      );
    }

    return {
      success: true,
      count: filteredData.length,
      geography: 'ZIP',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      state_filter: state || null,
      data: filteredData,
    };
  }

  // ============================================================================
  // RENT GROWTH ENDPOINTS (from pre-calculated data with HUD FMR fallback)
  // ============================================================================

  /**
   * Get rent YoY growth for metros (from calculated_metrics, includes HUD FMR proxy)
   */
  @Get('rent-yoy/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRentYoy() {
    const result = await this.calculatedMetricsService.getInvestmentMetricsForMap('zori_yoy' as any, 'metro');
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zori_yoy',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get rent 5-year CAGR for metros (from calculated_metrics, includes HUD FMR proxy)
   */
  @Get('rent-5yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRent5yr() {
    const result = await this.calculatedMetricsService.getInvestmentMetricsForMap('zori_5y_cagr' as any, 'metro');
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zori_5y_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  // ============================================================================
  // 3-YEAR HOME VALUE GROWTH ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get 3-year home value CAGR for metros (from calculated_metrics, uses Realtor data)
   */
  @Get('home-value-3yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroHomeValue3YrGrowth() {
    const result = await this.calculatedMetricsService.getInvestmentMetricsForMap('zhvi_3y_cagr' as any, 'metro');
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zhvi_3y_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  // ============================================================================
  // INCOME-TO-BUY ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get income-to-buy for national
   */
  @Get('income-to-buy/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalIncomeToBuy() {
    return this.getIncomeToBuyByGeo('national', 'National');
  }

  /**
   * Get income-to-buy for states
   * Returns the annual income required to afford the median-priced home
   */
  @Get('income-to-buy/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateIncomeToBuy() {
    return this.getIncomeToBuyByGeo('state', 'State');
  }

  /**
   * Get income-to-buy for metros
   */
  @Get('income-to-buy/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroIncomeToBuy() {
    return this.getIncomeToBuyByGeo('metro', 'Metro');
  }

  /**
   * Get income-to-buy for counties
   */
  @Get('income-to-buy/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyIncomeToBuy() {
    return this.getIncomeToBuyByGeo('county', 'County');
  }

  /**
   * Get income-to-buy for zip codes
   */
  @Get('income-to-buy/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipIncomeToBuy(@Query('state') state?: string) {
    return this.getIncomeToBuyByGeo('zip', 'ZIP', state);
  }

  /**
   * Generic income-to-buy fetcher for all geography types
   */
  private async getIncomeToBuyByGeo(
    geoType: string,
    geoLabel: string,
    stateFilter?: string,
  ) {
    if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
    // Get latest date from calculated_metrics
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geoType)
      .not('income_to_buy', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return {
        success: false,
        error: `No income_to_buy data available for ${geoLabel}`,
        data: [],
      };
    }

    const targetDate = latestRow.period_date;

    // Build query
    let query = this.supabase
      .from('calculated_metrics')
      .select('geography_id, geography_name, income_to_buy, period_date')
      .eq('geography_type', geoType)
      .eq('period_date', targetDate)
      .not('income_to_buy', 'is', null);

    // ZIP: do not filter by state. Return all zip income_to_buy for the date.
    // The map only loads state-specific GeoJSON, so it only has shapes for the selected state;
    // it looks up mapData[zipCode] per feature, so every zip with data will match when the
    // frontend has the shape. Filtering here by census/realtor allow-list was dropping zips
    // (null zip_name, or missing from census), causing missing coverage vs listing price.

    // Paginate for large datasets (county and zip)
    const allData: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data: pageData, error } = await query.range(
        offset,
        offset + pageSize - 1,
      );

      if (error) {
        return { success: false, error: error.message, data: [] };
      }

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Transform to map-friendly format
    const results = allData.map((row) => {
      const result: any = {
        region_id: row.geography_id,
        region_name: row.geography_name,
        income_to_buy: row.income_to_buy,
        value: row.income_to_buy,
        date: row.period_date,
      };

      // Add geography-specific ID fields
      if (geoType === 'metro') {
        result.cbsa_code = row.geography_id;
      } else if (geoType === 'county') {
        result.county_fips = row.geography_id;
      } else if (geoType === 'zip') {
        result.postal_code = row.geography_id;
      }

      return result;
    });

    return {
      success: true,
      count: results.length,
      geography: geoLabel,
      metric: 'income_to_buy',
      source: 'pre-calculated',
      date: targetDate,
      data: results,
    };
  }

  // ============================================================================
  // AFFORDABLE-HOME-PRICE ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get affordable-home-price for national
   */
  @Get('affordable-home-price/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('national', 'National');
  }

  /**
   * Get affordable-home-price for states
   * Returns the maximum home price affordable based on median household income
   */
  @Get('affordable-home-price/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('state', 'State');
  }

  /**
   * Get affordable-home-price for metros
   */
  @Get('affordable-home-price/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('metro', 'Metro');
  }

  /**
   * Get affordable-home-price for counties
   */
  @Get('affordable-home-price/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('county', 'County');
  }

  /**
   * Get affordable-home-price for zip codes
   */
  @Get('affordable-home-price/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipAffordableHomePrice(@Query('state') state?: string) {
    return this.getAffordableHomePriceByGeo('zip', 'ZIP', state);
  }

  /**
   * Generic affordable-home-price fetcher for all geography types
   */
  private async getAffordableHomePriceByGeo(
    geoType: string,
    geoLabel: string,
    stateFilter?: string,
  ) {
    if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
    // Get latest date from calculated_metrics
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geoType)
      .not('affordable_home_price', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return {
        success: false,
        error: `No affordable_home_price data available for ${geoLabel}`,
        data: [],
      };
    }

    const targetDate = latestRow.period_date;

    // Build query
    let query = this.supabase
      .from('calculated_metrics')
      .select(
        'geography_id, geography_name, affordable_home_price, period_date',
      )
      .eq('geography_type', geoType)
      .eq('period_date', targetDate)
      .not('affordable_home_price', 'is', null);

    // ZIP: do not filter by state (same as income_to_buy). Return all zip rows; map uses state-specific GeoJSON.

    // Paginate for large datasets (county and zip)
    const allData: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data: pageData, error } = await query.range(
        offset,
        offset + pageSize - 1,
      );

      if (error) {
        return { success: false, error: error.message, data: [] };
      }

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Transform to map-friendly format
    const results = allData.map((row) => {
      const result: any = {
        region_id: row.geography_id,
        region_name: row.geography_name,
        affordable_home_price: row.affordable_home_price,
        value: row.affordable_home_price,
        date: row.period_date,
      };

      // Add geography-specific ID fields
      if (geoType === 'metro') {
        result.cbsa_code = row.geography_id;
      } else if (geoType === 'county') {
        result.county_fips = row.geography_id;
      } else if (geoType === 'zip') {
        result.postal_code = row.geography_id;
      }

      return result;
    });

    return {
      success: true,
      count: results.length,
      geography: geoLabel,
      metric: 'affordable_home_price',
      source: 'pre-calculated',
      date: targetDate,
      data: results,
    };
  }

  // ============================================================================
  // YEARS-TO-SAVE ENDPOINTS (from pre-calculated data)
  // Formula: (Median listing price × 0.20) / (Median Income × 0.10)
  // ============================================================================

  /**
   * Get years-to-save for national
   */
  @Get('years-to-save/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalYearsToSave() {
    return this.getYearsToSaveByGeo('national', 'National');
  }

  /**
   * Get years-to-save for states
   * Returns the number of years needed to save for a 20% down payment
   */
  @Get('years-to-save/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateYearsToSave() {
    return this.getYearsToSaveByGeo('state', 'State');
  }

  /**
   * Get years-to-save for metros
   */
  @Get('years-to-save/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroYearsToSave() {
    return this.getYearsToSaveByGeo('metro', 'Metro');
  }

  /**
   * Get years-to-save for counties
   */
  @Get('years-to-save/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyYearsToSave() {
    return this.getYearsToSaveByGeo('county', 'County');
  }

  /**
   * Get years-to-save for zip codes
   */
  @Get('years-to-save/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipYearsToSave(@Query('state') state?: string) {
    return this.getYearsToSaveByGeo('zip', 'ZIP', state);
  }

  /**
   * Generic years-to-save fetcher for all geography types
   */
  private async getYearsToSaveByGeo(
    geoType: string,
    geoLabel: string,
    stateFilter?: string,
  ) {
    if (stateFilter) stateFilter = normalizeStateToCode(stateFilter);
    // Get latest date from calculated_metrics
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geoType)
      .not('years_to_save', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return {
        success: false,
        error: `No years_to_save data available for ${geoLabel}`,
        data: [],
      };
    }

    const targetDate = latestRow.period_date;

    // Build query
    let query = this.supabase
      .from('calculated_metrics')
      .select('geography_id, geography_name, years_to_save, period_date')
      .eq('geography_type', geoType)
      .eq('period_date', targetDate)
      .not('years_to_save', 'is', null);

    // ZIP: do not filter by state (same as income_to_buy). Return all zip rows; map uses state-specific GeoJSON.

    // Paginate for large datasets (county and zip)
    const allData: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data: pageData, error } = await query.range(
        offset,
        offset + pageSize - 1,
      );

      if (error) {
        return { success: false, error: error.message, data: [] };
      }

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Transform to map-friendly format
    const results = allData.map((row) => {
      const result: any = {
        region_id: row.geography_id,
        region_name: row.geography_name,
        years_to_save: row.years_to_save,
        value: row.years_to_save,
        date: row.period_date,
      };

      // Add geography-specific ID fields
      if (geoType === 'metro') {
        result.cbsa_code = row.geography_id;
      } else if (geoType === 'county') {
        result.county_fips = row.geography_id;
      } else if (geoType === 'zip') {
        result.postal_code = row.geography_id;
      }

      return result;
    });

    return {
      success: true,
      count: results.length,
      geography: geoLabel,
      metric: 'years_to_save',
      source: 'pre-calculated',
      date: targetDate,
      data: results,
    };
  }
}
