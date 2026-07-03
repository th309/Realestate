import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { CensusCache } from './census-cache';
import {
  getNationalData,
  getStateData,
  getMetroData,
} from './census-fetchers.helper';
import {
  getCountyData,
  getCityData,
  getZipData,
} from './census-paginated-fetchers.helper';
import { computeYoYGrowth } from './census-growth.helper';

// Backward-compatible re-exports (public API surface unchanged)
export type { CensusDataPoint } from './census.types';

@Injectable()
export class CensusService {
  private cache = new CensusCache();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ============================================================================
  // Population
  // ============================================================================
  async getNationalPopulation(year?: number) {
    return getNationalData(this.supabase, 'total_population', year);
  }
  async getStatePopulation(year?: number) {
    return getStateData(this.supabase, this.cache, 'total_population', year);
  }
  async getMetroPopulation(year?: number) {
    return getMetroData(this.supabase, this.cache, 'total_population', year);
  }
  async getCountyPopulation(year?: number) {
    return getCountyData(this.supabase, this.cache, 'total_population', year);
  }
  async getCityPopulation(year?: number, state?: string) {
    return getCityData(
      this.supabase,
      this.cache,
      'total_population',
      year,
      state,
    );
  }
  async getZipPopulation(year?: number, state?: string) {
    return getZipData(
      this.supabase,
      this.cache,
      'total_population',
      year,
      state,
    );
  }

  // ============================================================================
  // Population Growth (YoY) - computed from total_population
  // ============================================================================
  async getNationalPopulationGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) => getNationalData(this.supabase, 'total_population', y),
      'census_national',
      year,
    );
  }
  async getStatePopulationGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) => getStateData(this.supabase, this.cache, 'total_population', y),
      'census_state',
      year,
    );
  }
  async getMetroPopulationGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) => getMetroData(this.supabase, this.cache, 'total_population', y),
      'census_metro',
      year,
    );
  }
  async getCountyPopulationGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) => getCountyData(this.supabase, this.cache, 'total_population', y),
      'census_county',
      year,
    );
  }
  async getCityPopulationGrowth(year?: number, state?: string) {
    return computeYoYGrowth(
      this.supabase,
      (y) =>
        getCityData(this.supabase, this.cache, 'total_population', y, state),
      'census_city',
      year,
    );
  }
  async getZipPopulationGrowth(year?: number, state?: string) {
    // ZIP data uses RPC that doesn't support year param - fall back to raw column
    return getZipData(this.supabase, this.cache, 'population_yoy', year, state);
  }

  // ============================================================================
  // Median Income
  // ============================================================================
  async getNationalMedianIncome(year?: number) {
    return getNationalData(this.supabase, 'median_household_income', year);
  }
  async getStateMedianIncome(year?: number) {
    return getStateData(
      this.supabase,
      this.cache,
      'median_household_income',
      year,
    );
  }
  async getMetroMedianIncome(year?: number) {
    return getMetroData(
      this.supabase,
      this.cache,
      'median_household_income',
      year,
    );
  }
  async getCountyMedianIncome(year?: number) {
    return getCountyData(
      this.supabase,
      this.cache,
      'median_household_income',
      year,
    );
  }
  async getCityMedianIncome(year?: number, state?: string) {
    return getCityData(
      this.supabase,
      this.cache,
      'median_household_income',
      year,
      state,
    );
  }
  async getZipMedianIncome(year?: number, state?: string) {
    return getZipData(
      this.supabase,
      this.cache,
      'median_household_income',
      year,
      state,
    );
  }

  // ============================================================================
  // Income Growth (YoY) - computed from median_household_income
  // ============================================================================
  async getNationalIncomeGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) => getNationalData(this.supabase, 'median_household_income', y),
      'census_national',
      year,
    );
  }
  async getStateIncomeGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) =>
        getStateData(this.supabase, this.cache, 'median_household_income', y),
      'census_state',
      year,
    );
  }
  async getMetroIncomeGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) =>
        getMetroData(this.supabase, this.cache, 'median_household_income', y),
      'census_metro',
      year,
    );
  }
  async getCountyIncomeGrowth(year?: number) {
    return computeYoYGrowth(
      this.supabase,
      (y) =>
        getCountyData(this.supabase, this.cache, 'median_household_income', y),
      'census_county',
      year,
    );
  }
  async getCityIncomeGrowth(year?: number, state?: string) {
    return computeYoYGrowth(
      this.supabase,
      (y) =>
        getCityData(
          this.supabase,
          this.cache,
          'median_household_income',
          y,
          state,
        ),
      'census_city',
      year,
    );
  }
  async getZipIncomeGrowth(year?: number, state?: string) {
    // ZIP data uses RPC that doesn't support year param - fall back to raw column
    return getZipData(this.supabase, this.cache, 'income_yoy', year, state);
  }

  // ============================================================================
  // Median Age
  // ============================================================================
  async getNationalMedianAge(year?: number) {
    return getNationalData(this.supabase, 'median_age', year);
  }
  async getStateMedianAge(year?: number) {
    return getStateData(this.supabase, this.cache, 'median_age', year);
  }
  async getMetroMedianAge(year?: number) {
    return getMetroData(this.supabase, this.cache, 'median_age', year);
  }
  async getCountyMedianAge(year?: number) {
    return getCountyData(this.supabase, this.cache, 'median_age', year);
  }
  async getCityMedianAge(year?: number, state?: string) {
    return getCityData(this.supabase, this.cache, 'median_age', year, state);
  }
  async getZipMedianAge(year?: number, state?: string) {
    return getZipData(this.supabase, this.cache, 'median_age', year, state);
  }

  // ============================================================================
  // Homeownership Rate
  // ============================================================================
  async getNationalHomeownership(year?: number) {
    return getNationalData(this.supabase, 'homeownership_rate', year);
  }
  async getStateHomeownership(year?: number) {
    return getStateData(this.supabase, this.cache, 'homeownership_rate', year);
  }
  async getMetroHomeownership(year?: number) {
    return getMetroData(this.supabase, this.cache, 'homeownership_rate', year);
  }
  async getCountyHomeownership(year?: number) {
    return getCountyData(this.supabase, this.cache, 'homeownership_rate', year);
  }
  async getCityHomeownership(year?: number, state?: string) {
    return getCityData(
      this.supabase,
      this.cache,
      'homeownership_rate',
      year,
      state,
    );
  }
  async getZipHomeownership(year?: number, state?: string) {
    return getZipData(
      this.supabase,
      this.cache,
      'homeownership_rate',
      year,
      state,
    );
  }
}
