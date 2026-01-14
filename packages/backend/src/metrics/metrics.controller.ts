import { Controller, Get, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

// National median household income benchmark (approximate 2024 value)
const NATIONAL_MEDIAN_INCOME = 75000;
// Traditional price-to-income affordability benchmark
const PRICE_TO_INCOME_BENCHMARK = 3.5;

@Controller('api/metrics')
export class MetricsController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
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
      return { success: false, error: zhviError?.message || 'Failed to fetch ZHVI data', data: [] };
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
    const results = zhviData.map(metro => {
      const zhvi = metro.value;
      const cbsaCode = metro.cbsa_code;

      // Use local median income if available, otherwise national benchmark
      const medianIncome = (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

      // Calculate overvalued percentage
      const priceToIncome = zhvi / medianIncome;
      const overvaluedPct = ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) * 100;

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
      return { success: false, error: zoriError?.message || 'Failed to fetch ZORI data', data: [] };
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
      .filter(metro => zhviByRegion[metro.region_id])
      .map(metro => {
        const zori = metro.value;
        const zhvi = zhviByRegion[metro.region_id];
        const capRate = (zori * 12 * EXPENSE_RATIO) / zhvi * 100;

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
   * Get 5-year home value growth for metros
   * Calculated as: (current_zhvi / zhvi_5_years_ago)^(1/5) - 1
   * Returns annual compound growth rate as percentage
   */
  @Get('home-value-5yr/metros')
  async getMetroHomeValue5YrGrowth(@Query('date') date?: string) {
    // Get current date (latest ZHVI data)
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

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current ZHVI data
    const { data: currentData, error: currentError } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, region_name, value, cbsa_code')
      .eq('geography', 'Metro')
      .eq('date', targetDate)
      .not('value', 'is', null);

    if (currentError || !currentData) {
      return { success: false, error: currentError?.message || 'Failed to fetch current ZHVI data', data: [] };
    }

    // Get historical ZHVI data (5 years ago)
    // Try to get closest date within 3 months of 5 years ago
    const { data: pastData } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date')
      .eq('geography', 'Metro')
      .gte('date', pastDateStr)
      .lte('date', new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('value', 'is', null)
      .order('date', { ascending: true });

    // Create lookup for past values (use earliest available date per region)
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    if (pastData) {
      for (const row of pastData) {
        if (!pastByRegion[row.region_id]) {
          pastByRegion[row.region_id] = { value: row.value, date: row.date };
        }
      }
    }

    // Calculate 5-year CAGR for each metro
    const results = currentData
      .filter(metro => pastByRegion[metro.region_id])
      .map(metro => {
        const currentValue = metro.value;
        const pastValue = pastByRegion[metro.region_id].value;

        // Calculate CAGR: (current / past)^(1/5) - 1
        const cagr = Math.pow(currentValue / pastValue, 1 / 5) - 1;
        const cagrPercent = cagr * 100;

        return {
          region_id: metro.region_id,
          region_name: metro.region_name,
          cbsa_code: metro.cbsa_code,
          current_zhvi: currentValue,
          past_zhvi: pastValue,
          cagr_5yr: Math.round(cagrPercent * 100) / 100, // Round to 2 decimal places
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'Metro',
      metric: 'home_value_5yr_cagr',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }

  /**
   * Get 5-year home value growth for states
   */
  @Get('home-value-5yr/states')
  async getStateHomeValue5YrGrowth(@Query('date') date?: string) {
    // Get current date (latest ZHVI data)
    let targetDate = date;
    if (!targetDate) {
      const { data: latestDate } = await this.supabase
        .from('zillow_zhvi')
        .select('date')
        .eq('geography', 'State')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestDate?.date;
    }

    if (!targetDate) {
      return { success: false, error: 'No ZHVI data available', data: [] };
    }

    // Calculate 5 years ago date
    const currentDate = new Date(targetDate);
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];

    // Get current ZHVI data
    const { data: currentData, error: currentError } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, region_name, value')
      .eq('geography', 'State')
      .eq('date', targetDate)
      .not('value', 'is', null);

    if (currentError || !currentData) {
      return { success: false, error: currentError?.message || 'Failed to fetch current ZHVI data', data: [] };
    }

    // Get historical ZHVI data (5 years ago)
    const { data: pastData } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date')
      .eq('geography', 'State')
      .gte('date', pastDateStr)
      .lte('date', new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('value', 'is', null)
      .order('date', { ascending: true });

    // Create lookup for past values
    const pastByRegion: Record<string, { value: number; date: string }> = {};
    if (pastData) {
      for (const row of pastData) {
        if (!pastByRegion[row.region_id]) {
          pastByRegion[row.region_id] = { value: row.value, date: row.date };
        }
      }
    }

    // Calculate 5-year CAGR for each state
    const results = currentData
      .filter(state => pastByRegion[state.region_id])
      .map(state => {
        const currentValue = state.value;
        const pastValue = pastByRegion[state.region_id].value;

        const cagr = Math.pow(currentValue / pastValue, 1 / 5) - 1;
        const cagrPercent = cagr * 100;

        return {
          region_id: state.region_id,
          region_name: state.region_name,
          current_zhvi: currentValue,
          past_zhvi: pastValue,
          cagr_5yr: Math.round(cagrPercent * 100) / 100,
        };
      });

    return {
      success: true,
      count: results.length,
      geography: 'State',
      metric: 'home_value_5yr_cagr',
      current_date: targetDate,
      past_date: pastDateStr,
      data: results,
    };
  }
}
