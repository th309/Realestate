import { Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  ) {}

  /**
   * Get overvalued percentage for metros
   * Calculated as: ((ZHVI / median_income) - 3.5) / 3.5 * 100
   * Uses national median income as benchmark if local data unavailable
   */
  @Get('overvalued/metros')
  async getMetroOvervalued(@Query('date') date?: string) {
    // Get latest ZHVI data for metros
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('zillow_zhvi')
        .select('date')
        .eq('geography', 'Metro')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.date;
    }

    if (!targetDate) {
      return { success: false, error: 'No ZHVI data available', data: [] };
    }

    // Get ZHVI data for all metros
    const { data: zhviData, error: zhviError } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, region_name, value, cbsa_code')
      .eq('geography', 'Metro')
      .eq('date', targetDate)
      .not('value', 'is', null);

    if (zhviError || !zhviData) {
      return {
        success: false,
        error: zhviError?.message || 'Failed to fetch ZHVI data',
        data: [],
      };
    }

    // Try to get Census median income data for metros
    const { data: incomeData } = await this.supabase
      .from('census_data')
      .select('geography_id, value')
      .eq('geography_type', 'metro')
      .eq('metric_name', 'median_income')
      .order('year', { ascending: false });

    // Create income lookup by CBSA code
    const incomeByGeo: Record<string, number> = {};
    if (incomeData) {
      for (const row of incomeData) {
        if (row.value && !incomeByGeo[row.geography_id]) {
          incomeByGeo[row.geography_id] = Number(row.value);
        }
      }
    }

    // Calculate overvalued percentage for each metro
    const results = zhviData.map((metro) => {
      const zhvi = metro.value;
      const cbsaCode = metro.cbsa_code;

      // Use local median income if available, otherwise national benchmark
      const medianIncome =
        (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

      // Calculate overvalued percentage
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
        overvalued_pct: Math.round(overvaluedPct * 10) / 10, // Round to 1 decimal
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
    const results = zoriData
      .filter((metro) => zhviByRegion[metro.region_id])
      .map((metro) => {
        const zori = metro.value;
        const zhvi = zhviByRegion[metro.region_id];
        const capRate = ((zori * 12 * EXPENSE_RATIO) / zhvi) * 100;

        return {
          region_id: metro.region_id,
          region_name: metro.region_name,
          cbsa_code: metro.cbsa_code,
          zori,
          zhvi,
          cap_rate: Math.round(capRate * 100) / 100,
        };
      });

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
  // INVESTMENT METRICS ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get gross yield for metros (from pre-calculated data, with fallback)
   */
  @Get('gross-yield/metros')
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

  /**
   * Get GRM (Gross Rent Multiplier) for metros
   */
  @Get('grm/metros')
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

  /**
   * Get all investment metrics for a specific metro
   */
  @Get('investment/:geoType/:geoId')
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
  async calculateInvestmentMetricsBatch() {
    const results =
      await this.calculatedMetricsService.calculateAllInvestmentMetrics();
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
  @Post('calculate-5yr-growth')
  async calculate5YrGrowthBatch() {
    const results =
      await this.calculatedMetricsService.calculate5YrGrowthForAll();
    return {
      success: true,
      message: 'Batch calculation completed',
      results: {
        metros: results.metros,
        states: results.states,
        counties: results.counties,
        zips: results.zips,
      },
      totals: {
        processed:
          results.metros.processed +
          results.states.processed +
          results.counties.processed +
          results.zips.processed,
        stored:
          results.metros.stored +
          results.states.stored +
          results.counties.stored +
          results.zips.stored,
      },
    };
  }

  /**
   * Trigger batch calculation for a specific geography type
   */
  @Post('calculate-5yr-growth/:geoType')
  async calculate5YrGrowthByGeo(@Param('geoType') geoType?: string) {
    let result: { processed: number; stored: number };

    switch (geoType) {
      case 'metros':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForMetros();
        break;
      case 'states':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForStates();
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
          await this.calculatedMetricsService.calculate5YrGrowthForNational();
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
   * Get 5-year home value growth for metros
   * First tries pre-calculated table, falls back to on-the-fly calculation
   */
  @Get('home-value-5yr/metros')
  async getMetroHomeValue5YrGrowth(@Query('date') date?: string) {
    // First try pre-calculated data
    const preCalculated =
      await this.calculatedMetricsService.get5YrGrowthForMap('metro');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'home_value_5yr',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation
    return this.calculateMetroHomeValue5YrGrowth(date);
  }

  /**
   * On-the-fly calculation for metro 5-year growth (fallback)
   */
  private async calculateMetroHomeValue5YrGrowth(date?: string) {
    // Get current date (latest data from realtor_metro table)
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('realtor_metro')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No Realtor data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current data from realtor_metro
    const { data: currentData, error: currentError } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title, median_listing_price')
      .eq('period_date', targetDate)
      .not('median_listing_price', 'is', null);

    if (currentError || !currentData) {
      return {
        success: false,
        error: currentError?.message || 'Failed to fetch current data',
        data: [],
      };
    }

    // Get historical data (5 years ago) - try to get closest date within 3 months
    const { data: pastData } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, median_listing_price, period_date')
      .gte('period_date', pastDateStr)
      .lte(
        'period_date',
        new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      )
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: true });

    // Create lookup for past values (use earliest available date per region)
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    if (pastData) {
      for (const row of pastData) {
        if (!pastByRegion[row.cbsa_code]) {
          pastByRegion[row.cbsa_code] = {
            value: row.median_listing_price,
            date: row.period_date,
          };
        }
      }
    }

    // Calculate 5-year growth for each metro: ((current - past) / past) * 100
    const results = currentData
      .filter(
        (metro) =>
          pastByRegion[metro.cbsa_code] &&
          pastByRegion[metro.cbsa_code].value > 0,
      )
      .map((metro) => {
        const currentValue = metro.median_listing_price;
        const pastValue = pastByRegion[metro.cbsa_code].value;

        const growthPct = ((currentValue - pastValue) / pastValue) * 100;

        return {
          region_id: metro.cbsa_code,
          region_name: metro.cbsa_title,
          cbsa_code: metro.cbsa_code,
          value: Math.round(growthPct * 100) / 100,
          cagr_5yr: Math.round(growthPct * 100) / 100,
          date: targetDate,
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'Metro',
      metric: 'home_value_5yr',
      source: 'calculated',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }

  /**
   * Get 5-year home value growth for national
   * First tries pre-calculated table, falls back to on-the-fly calculation
   */
  @Get('home-value-5yr/national')
  async getNationalHomeValue5YrGrowth(@Query('date') date?: string) {
    // First try pre-calculated data
    const preCalculated =
      await this.calculatedMetricsService.get5YrGrowthForMap('national');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'National',
        metric: 'home_value_5yr',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation
    return this.calculateNationalHomeValue5YrGrowth(date);
  }

  /**
   * On-the-fly calculation for national 5-year growth (fallback)
   */
  private async calculateNationalHomeValue5YrGrowth(date?: string) {
    // Get current date
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('realtor_national')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No Realtor data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current data from realtor_national
    const { data: currentData, error: currentError } = await this.supabase
      .from('realtor_national')
      .select('median_listing_price')
      .eq('period_date', targetDate)
      .eq('country', 'United States')
      .single();

    if (currentError || !currentData) {
      return {
        success: false,
        error: currentError?.message || 'Failed to fetch current data',
        data: [],
      };
    }

    // Get historical data (5 years ago)
    const { data: pastData } = await this.supabase
      .from('realtor_national')
      .select('median_listing_price, period_date')
      .gte('period_date', pastDateStr)
      .lte(
        'period_date',
        new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      )
      .not('median_listing_price', 'is', null)
      .eq('country', 'United States')
      .order('period_date', { ascending: true })
      .limit(1)
      .single();

    if (!pastData || !pastData.median_listing_price) {
      // Return empty results if no history
      return {
        success: true,
        count: 0,
        geography: 'National',
        metric: 'home_value_5yr',
        source: 'calculated',
        data: [],
      };
    }

    // Calculate 5-year growth
    const currentValue = currentData.median_listing_price;
    const pastValue = pastData.median_listing_price;
    const growthPct = ((currentValue - pastValue) / pastValue) * 100;

    const result = {
      region_id: 'usa',
      region_name: 'United States',
      value: Math.round(growthPct * 100) / 100,
      cagr_5yr: Math.round(growthPct * 100) / 100,
      date: targetDate,
    };

    return {
      success: true,
      count: 1,
      geography: 'National',
      metric: 'home_value_5yr',
      source: 'calculated',
      current_date: targetDate,
      past_date: pastData.period_date,
      data: [result],
    };
  }

  /**
   * Get 5-year home value growth for states
   * First tries pre-calculated table, falls back to on-the-fly calculation
   */
  @Get('home-value-5yr/states')
  async getStateHomeValue5YrGrowth(@Query('date') date?: string) {
    // First try pre-calculated data
    const preCalculated =
      await this.calculatedMetricsService.get5YrGrowthForMap('state');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'State',
        metric: 'home_value_5yr',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation
    return this.calculateStateHomeValue5YrGrowth(date);
  }

  /**
   * On-the-fly calculation for state 5-year growth (fallback)
   */
  private async calculateStateHomeValue5YrGrowth(date?: string) {
    // Get current date
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('realtor_state')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No Realtor data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current data from realtor_state
    const { data: currentData, error: currentError } = await this.supabase
      .from('realtor_state')
      .select('state_id, state_name, median_listing_price')
      .eq('period_date', targetDate)
      .not('median_listing_price', 'is', null);

    if (currentError || !currentData) {
      return {
        success: false,
        error: currentError?.message || 'Failed to fetch current data',
        data: [],
      };
    }

    // Get historical data (5 years ago)
    const { data: pastData } = await this.supabase
      .from('realtor_state')
      .select('state_id, median_listing_price, period_date')
      .gte('period_date', pastDateStr)
      .lte(
        'period_date',
        new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      )
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: true });

    // Create lookup for past values
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    if (pastData) {
      for (const row of pastData) {
        if (!pastByRegion[row.state_id]) {
          pastByRegion[row.state_id] = {
            value: row.median_listing_price,
            date: row.period_date,
          };
        }
      }
    }

    // Calculate 5-year growth for each state
    const results = currentData
      .filter(
        (state) =>
          pastByRegion[state.state_id] &&
          pastByRegion[state.state_id].value > 0,
      )
      .map((state) => {
        const currentValue = state.median_listing_price;
        const pastValue = pastByRegion[state.state_id].value;

        const growthPct = ((currentValue - pastValue) / pastValue) * 100;

        return {
          region_id: state.state_id,
          region_name: state.state_name,
          value: Math.round(growthPct * 100) / 100,
          cagr_5yr: Math.round(growthPct * 100) / 100,
          date: targetDate,
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'State',
      metric: 'home_value_5yr',
      source: 'calculated',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }

  /**
   * Get 5-year home value growth for counties
   * First tries pre-calculated table, falls back to on-the-fly calculation
   */
  @Get('home-value-5yr/counties')
  async getCountyHomeValue5YrGrowth(@Query('date') date?: string) {
    // First try pre-calculated data
    const preCalculated =
      await this.calculatedMetricsService.get5YrGrowthForMap('county');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'home_value_5yr',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation
    return this.calculateCountyHomeValue5YrGrowth(date);
  }

  /**
   * On-the-fly calculation for county 5-year growth (fallback)
   */
  private async calculateCountyHomeValue5YrGrowth(date?: string) {
    // Get current date
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('realtor_county')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No Realtor data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current data - paginate to get all counties
    const allCurrentData: any[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data: pageData, error } = await this.supabase
        .from('realtor_county')
        .select('county_fips, county_name, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error) {
        return { success: false, error: error.message, data: [] };
      }

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Get historical data - paginate
    const allPastData: any[] = [];
    offset = 0;

    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_county')
        .select('county_fips, median_listing_price, period_date')
        .gte('period_date', pastDateStr)
        .lte(
          'period_date',
          new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        )
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (!pageData || pageData.length === 0) break;
      allPastData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Create lookup for past values
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    for (const row of allPastData) {
      if (!pastByRegion[row.county_fips]) {
        pastByRegion[row.county_fips] = {
          value: row.median_listing_price,
          date: row.period_date,
        };
      }
    }

    // Calculate 5-year growth for each county
    const results = allCurrentData
      .filter(
        (county) =>
          pastByRegion[county.county_fips] &&
          pastByRegion[county.county_fips].value > 0,
      )
      .map((county) => {
        const currentValue = county.median_listing_price;
        const pastValue = pastByRegion[county.county_fips].value;

        const growthPct = ((currentValue - pastValue) / pastValue) * 100;

        return {
          region_id: county.county_fips,
          region_name: county.county_name,
          county_fips: county.county_fips,
          value: Math.round(growthPct * 100) / 100,
          cagr_5yr: Math.round(growthPct * 100) / 100,
          date: targetDate,
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'County',
      metric: 'home_value_5yr',
      source: 'calculated',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }

  /**
   * Get 5-year home value growth for zip codes
   * First tries pre-calculated table, falls back to on-the-fly calculation
   */
  @Get('home-value-5yr/zips')
  async getZipHomeValue5YrGrowth(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    // First try pre-calculated data (if no state filter)
    if (!state) {
      const preCalculated =
        await this.calculatedMetricsService.get5YrGrowthForMap('zip');
      if (preCalculated.success && preCalculated.data.length > 0) {
        return {
          success: true,
          count: preCalculated.data.length,
          geography: 'ZIP',
          metric: 'home_value_5yr',
          source: 'pre-calculated',
          data: preCalculated.data,
        };
      }
    }

    // Fall back to on-the-fly calculation (also handles state filter)
    return this.calculateZipHomeValue5YrGrowth(state, date);
  }

  /**
   * On-the-fly calculation for zip 5-year growth (fallback)
   */
  private async calculateZipHomeValue5YrGrowth(state?: string, date?: string) {
    if (state) state = normalizeStateToCode(state);
    // Get current date
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('realtor_zip')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.period_date;
    }

    if (!targetDate) {
      return { success: false, error: 'No Realtor data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Build state filter pattern (zip_name format: "city, ST")
    const statePattern = state ? `%, ${state.toUpperCase()}` : null;

    // Get current data - paginate
    const allCurrentData: any[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      let query = this.supabase
        .from('realtor_zip')
        .select('postal_code, zip_name, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null);

      if (statePattern) {
        query = query.ilike('zip_name', statePattern);
      }

      const { data: pageData, error } = await query.range(
        offset,
        offset + pageSize - 1,
      );

      if (error) {
        return { success: false, error: error.message, data: [] };
      }

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Get historical data - paginate
    const allPastData: any[] = [];
    offset = 0;

    while (true) {
      let query = this.supabase
        .from('realtor_zip')
        .select('postal_code, median_listing_price, period_date')
        .gte('period_date', pastDateStr)
        .lte(
          'period_date',
          new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        )
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true });

      if (statePattern) {
        query = query.ilike('zip_name', statePattern);
      }

      const { data: pageData } = await query.range(
        offset,
        offset + pageSize - 1,
      );

      if (!pageData || pageData.length === 0) break;
      allPastData.push(...pageData);
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    // Create lookup for past values
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    for (const row of allPastData) {
      if (!pastByRegion[row.postal_code]) {
        pastByRegion[row.postal_code] = {
          value: row.median_listing_price,
          date: row.period_date,
        };
      }
    }

    // Calculate 5-year growth for each zip
    const results = allCurrentData
      .filter(
        (zip) =>
          pastByRegion[zip.postal_code] &&
          pastByRegion[zip.postal_code].value > 0,
      )
      .map((zip) => {
        const currentValue = zip.median_listing_price;
        const pastValue = pastByRegion[zip.postal_code].value;

        const growthPct = ((currentValue - pastValue) / pastValue) * 100;

        return {
          region_id: zip.postal_code,
          region_name: zip.zip_name,
          postal_code: zip.postal_code,
          value: Math.round(growthPct * 100) / 100,
          cagr_5yr: Math.round(growthPct * 100) / 100,
          date: targetDate,
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'ZIP',
      metric: 'home_value_5yr',
      source: 'calculated',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }

  // ============================================================================
  // INCOME-TO-BUY ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get income-to-buy for national
   */
  @Get('income-to-buy/national')
  async getNationalIncomeToBuy() {
    return this.getIncomeToBuyByGeo('national', 'National');
  }

  /**
   * Get income-to-buy for states
   * Returns the annual income required to afford the median-priced home
   */
  @Get('income-to-buy/states')
  async getStateIncomeToBuy() {
    return this.getIncomeToBuyByGeo('state', 'State');
  }

  /**
   * Get income-to-buy for metros
   */
  @Get('income-to-buy/metros')
  async getMetroIncomeToBuy() {
    return this.getIncomeToBuyByGeo('metro', 'Metro');
  }

  /**
   * Get income-to-buy for counties
   */
  @Get('income-to-buy/counties')
  async getCountyIncomeToBuy() {
    return this.getIncomeToBuyByGeo('county', 'County');
  }

  /**
   * Get income-to-buy for zip codes
   */
  @Get('income-to-buy/zips')
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
  async getNationalAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('national', 'National');
  }

  /**
   * Get affordable-home-price for states
   * Returns the maximum home price affordable based on median household income
   */
  @Get('affordable-home-price/states')
  async getStateAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('state', 'State');
  }

  /**
   * Get affordable-home-price for metros
   */
  @Get('affordable-home-price/metros')
  async getMetroAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('metro', 'Metro');
  }

  /**
   * Get affordable-home-price for counties
   */
  @Get('affordable-home-price/counties')
  async getCountyAffordableHomePrice() {
    return this.getAffordableHomePriceByGeo('county', 'County');
  }

  /**
   * Get affordable-home-price for zip codes
   */
  @Get('affordable-home-price/zips')
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

    // Handle state filter for ZIP codes
    if (stateFilter && geoType === 'zip') {
      const statePattern = `ZIP ${stateFilter.toUpperCase()}%`;
      query = query.ilike('geography_name', statePattern);
    }

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
  async getNationalYearsToSave() {
    return this.getYearsToSaveByGeo('national', 'National');
  }

  /**
   * Get years-to-save for states
   * Returns the number of years needed to save for a 20% down payment
   */
  @Get('years-to-save/states')
  async getStateYearsToSave() {
    return this.getYearsToSaveByGeo('state', 'State');
  }

  /**
   * Get years-to-save for metros
   */
  @Get('years-to-save/metros')
  async getMetroYearsToSave() {
    return this.getYearsToSaveByGeo('metro', 'Metro');
  }

  /**
   * Get years-to-save for counties
   */
  @Get('years-to-save/counties')
  async getCountyYearsToSave() {
    return this.getYearsToSaveByGeo('county', 'County');
  }

  /**
   * Get years-to-save for zip codes
   */
  @Get('years-to-save/zips')
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

    // Handle state filter for ZIP codes
    if (stateFilter && geoType === 'zip') {
      const statePattern = `ZIP ${stateFilter.toUpperCase()}%`;
      query = query.ilike('geography_name', statePattern);
    }

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
