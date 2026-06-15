// FILE-SIZE EXCEPTION (CLAUDE.md §1.3): one cohesive affordability DB pipeline; splitting the geo-pipeline methods further risks behavior. See docs/superpowers/specs/2026-06-15-calculated-metrics-service-refactor-design.md.
import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { normalizeZipKey } from '../../common/zip';
import {
  AFF,
  AFF_REALTOR_GEOS,
  AFF_CENSUS_GEOS,
  AFF_CENSUS_BY_GEO,
} from './affordability-metrics.config';

@Injectable()
export class AffordabilityMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** Annual income needed to afford the median home (PITI / 28% front-end DTI). */
  private affIncomeToBuy(price: number, mortgageRate: number): number | null {
    if (!price || price === 0) return null;
    const a = AFF;
    const loanAmount = price * (1 - a.DOWN_PAYMENT_PCT);
    const monthlyRate = mortgageRate / 12;
    const factor = Math.pow(1 + monthlyRate, a.MORTGAGE_TERM_MONTHS);
    const monthlyMortgage =
      (loanAmount * (monthlyRate * factor)) / (factor - 1);
    const monthlyTaxes = (price * a.PROPERTY_TAX_RATE) / 12;
    const monthlyInsurance = (price * a.INSURANCE_RATE) / 12;
    const monthlyPITI = monthlyMortgage + monthlyTaxes + monthlyInsurance;
    const annualIncome = (monthlyPITI * 12) / a.FRONT_END_DTI;
    return Math.round(annualIncome);
  }

  /** Max affordable home price given local median income. */
  private affAffordableHomePrice(
    annualIncome: number,
    mortgageRate: number,
  ): number | null {
    if (!annualIncome || annualIncome === 0) return null;
    const a = AFF;
    const monthlyRate = mortgageRate / 12;
    const factor = Math.pow(1 + monthlyRate, a.MORTGAGE_TERM_MONTHS);
    const pmtFactor = (monthlyRate * factor) / (factor - 1);
    const maxMonthlyPITI = (annualIncome * a.FRONT_END_DTI) / 12;
    const taxInsuranceMonthlyRate =
      (a.PROPERTY_TAX_RATE + a.INSURANCE_RATE) / 12;
    const denominator =
      (1 - a.DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
    return Math.round(maxMonthlyPITI / denominator);
  }

  /** Years to save a 20% down payment at a 10% savings rate. */
  private affYearsToSave(price: number, income: number): number | null {
    if (!price || price === 0 || !income || income === 0) return null;
    const a = AFF;
    const downPayment = price * a.DOWN_PAYMENT_RATE;
    const annualSavings = income * a.SAVINGS_RATE;
    return Math.round((downPayment / annualSavings) * 10) / 10;
  }

  /** Latest 30-yr fixed mortgage rate from FRED; 7% fallback if key/API absent. */
  private async affFetchMortgageRate(): Promise<number> {
    // FRED is an OPTIONAL enrichment source: if the key is absent we degrade to
    // the documented domain-default rate (a business default, not a secret) with
    // a warning, rather than crashing the whole monthly refresh. We never invent
    // a fallback *key* (that's what §1.2 forbids).
    const fredApiKey = process.env.FRED_API_KEY;
    if (!fredApiKey) {
      console.warn(
        '[affordability] FRED_API_KEY not set — using default mortgage rate',
      );
      return AFF.DEFAULT_MORTGAGE_RATE;
    }
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${AFF.FRED_MORTGAGE_SERIES}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=1`;
      const response = await fetch(url);
      if (!response.ok) return AFF.DEFAULT_MORTGAGE_RATE;
      const data = await response.json();
      if (data.observations && data.observations.length > 0) {
        const latestRate = parseFloat(data.observations[0].value);
        if (!isNaN(latestRate)) return latestRate / 100;
      }
      return AFF.DEFAULT_MORTGAGE_RATE;
    } catch {
      return AFF.DEFAULT_MORTGAGE_RATE;
    }
  }

  private async affUpsertBatch(
    records: Record<string, unknown>[],
  ): Promise<{ stored: number; errors: string[] }> {
    const errors: string[] = [];
    let stored = 0;
    for (let i = 0; i < records.length; i += AFF.BATCH_SIZE) {
      const batch = records.slice(i, i + AFF.BATCH_SIZE);
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(batch, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) errors.push(error.message);
      else stored += batch.length;
    }
    return { stored, errors };
  }

  private async affIncomeToBuyForGeo(
    config: {
      tableName: string;
      geoType: string;
      idField: string;
      nameField: string;
    },
    mortgageRate: number,
  ): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    const { data: latestRow } = await this.supabase
      .from(config.tableName)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    if (!latestRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No data in ${config.tableName}`],
      };
    }
    const targetDate = latestRow.period_date;

    let allData: any[] = [];
    let offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'median_listing_price'
          : `${config.idField}, ${config.nameField}, median_listing_price`;
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(selectCols)
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (allData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors:
          errors.length > 0 ? errors : [`No data for ${config.tableName}`],
      };
    }

    const records: Record<string, unknown>[] = [];
    for (const row of allData) {
      const incomeToBuy = this.affIncomeToBuy(
        row.median_listing_price,
        mortgageRate,
      );
      if (incomeToBuy === null) continue;
      let geoId: string;
      let geoName: string;
      if (config.geoType === 'national') {
        geoId = 'US';
        geoName = 'United States';
      } else {
        geoId = String(row[config.idField]);
        if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
        geoName = row[config.nameField] || geoId;
      }
      records.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        income_to_buy: incomeToBuy,
        calculated_at: new Date().toISOString(),
      });
    }

    const { stored, errors: upsertErrors } = await this.affUpsertBatch(records);
    return {
      processed: allData.length,
      stored,
      errors: [...errors, ...upsertErrors],
    };
  }

  private async affAffordableHomePriceForGeo(
    config: {
      tableName: string;
      geoType: string;
      idField: string;
      nameField: string;
    },
    mortgageRate: number,
  ): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    let allData: any[] = [];
    let offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'year, median_household_income'
          : `${config.idField}, ${config.nameField}, year, median_household_income`;
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(selectCols)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (allData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors:
          errors.length > 0
            ? errors
            : [`No income data for ${config.tableName}`],
      };
    }

    const latestByGeo: Record<string, any> = {};
    for (const row of allData) {
      const geoId =
        config.geoType === 'national' ? 'US' : String(row[config.idField]);
      if (!latestByGeo[geoId]) latestByGeo[geoId] = row;
    }

    const { data: latestDateRow } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    const targetDate =
      latestDateRow?.period_date || new Date().toISOString().split('T')[0];

    const records: Record<string, unknown>[] = [];
    for (const [geoId, row] of Object.entries(latestByGeo)) {
      const affordablePrice = this.affAffordableHomePrice(
        row.median_household_income,
        mortgageRate,
      );
      if (affordablePrice === null) continue;
      const finalGeoId =
        config.geoType === 'zip' ? normalizeZipKey(geoId) : geoId;
      let geoName: string;
      if (config.geoType === 'national') geoName = 'United States';
      else if (config.geoType === 'zip') geoName = `ZIP ${finalGeoId}`;
      else geoName = row[config.nameField] || geoId;
      records.push({
        geography_id: finalGeoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        affordable_home_price: affordablePrice,
        calculated_at: new Date().toISOString(),
      });
    }

    const { stored, errors: upsertErrors } = await this.affUpsertBatch(records);
    return {
      processed: Object.keys(latestByGeo).length,
      stored,
      errors: [...errors, ...upsertErrors],
    };
  }

  private async affYearsToSaveForGeo(config: {
    tableName: string;
    geoType: string;
    idField: string;
    nameField: string;
  }): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    const censusConfig = AFF_CENSUS_BY_GEO[config.geoType];

    const { data: latestDateRow } = await this.supabase
      .from(config.tableName)
      .select('period_date')
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    if (!latestDateRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No listing price data for ${config.geoType}`],
      };
    }
    const targetDate = latestDateRow.period_date;

    let realtorData: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(`${config.idField}, ${config.nameField}, median_listing_price`)
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      realtorData = realtorData.concat(data);
      if (data.length < AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (realtorData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No Realtor data for ${config.geoType}`],
      };
    }

    const incomeByGeo: Record<string, number> = {};
    offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'year, median_household_income'
          : `${censusConfig.idField}, year, median_household_income`;
      const { data, error } = await this.supabase
        .from(censusConfig.tableName)
        .select(selectCols)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data as any[]) {
        let geoId =
          config.geoType === 'national'
            ? 'US'
            : String(row[censusConfig.idField]);
        if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
        if (!incomeByGeo[geoId])
          incomeByGeo[geoId] = Number(row.median_household_income);
      }
      offset += data.length;
      if (data.length < AFF.PAGE_SIZE) break;
    }

    let stored = 0;
    const records: Record<string, unknown>[] = [];
    for (const row of realtorData) {
      let geoId: string;
      let geoName: string;
      if (config.geoType === 'national') {
        geoId = 'US';
        geoName = 'United States';
      } else if (config.geoType === 'zip') {
        geoId = normalizeZipKey(String(row[config.idField]));
        geoName = `ZIP ${geoId}`;
      } else if (config.geoType === 'state') {
        geoId = row[config.idField];
        geoName = row[config.nameField];
      } else {
        geoId = row[config.idField];
        geoName = row[config.nameField] || geoId;
      }
      const price = row.median_listing_price;
      const income = incomeByGeo[geoId] ?? incomeByGeo[row[config.idField]];
      if (!income) continue;
      const yearsToSave = this.affYearsToSave(price, income);
      if (yearsToSave === null) continue;
      records.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        years_to_save: yearsToSave,
        calculated_at: new Date().toISOString(),
      });
      if (records.length >= AFF.BATCH_SIZE) {
        const { error: upsertError } = await this.supabase
          .from('calculated_metrics')
          .upsert(records, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (upsertError) errors.push(upsertError.message);
        else stored += records.length;
        records.length = 0;
      }
    }

    if (records.length > 0) {
      const { error: upsertError } = await this.supabase
        .from('calculated_metrics')
        .upsert(records, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (upsertError) errors.push(upsertError.message);
      else stored += records.length;
    }

    return { processed: realtorData.length, stored, errors };
  }

  /**
   * Run all three affordability metrics across every geo level. The FRED
   * mortgage rate is fetched ONCE and shared by income_to_buy and
   * affordable_home_price (years_to_save does not use it).
   */
  async calculateAllAffordabilityMetrics(): Promise<{
    incomeToBuy: { processed: number; stored: number; errors: string[] };
    affordableHomePrice: {
      processed: number;
      stored: number;
      errors: string[];
    };
    yearsToSave: { processed: number; stored: number; errors: string[] };
  }> {
    const mortgageRate = await this.affFetchMortgageRate();
    const blank = () => ({ processed: 0, stored: 0, errors: [] as string[] });
    const incomeToBuy = blank();
    const affordableHomePrice = blank();
    const yearsToSave = blank();

    for (const config of AFF_REALTOR_GEOS) {
      const r = await this.affIncomeToBuyForGeo(config, mortgageRate);
      incomeToBuy.processed += r.processed;
      incomeToBuy.stored += r.stored;
      incomeToBuy.errors.push(...r.errors);
    }
    for (const config of AFF_CENSUS_GEOS) {
      const r = await this.affAffordableHomePriceForGeo(config, mortgageRate);
      affordableHomePrice.processed += r.processed;
      affordableHomePrice.stored += r.stored;
      affordableHomePrice.errors.push(...r.errors);
    }
    for (const config of AFF_REALTOR_GEOS) {
      const r = await this.affYearsToSaveForGeo(config);
      yearsToSave.processed += r.processed;
      yearsToSave.stored += r.stored;
      yearsToSave.errors.push(...r.errors);
    }

    return { incomeToBuy, affordableHomePrice, yearsToSave };
  }
}
