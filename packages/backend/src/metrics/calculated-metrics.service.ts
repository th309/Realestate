import { Injectable } from '@nestjs/common';
import { calculateAll as calculateAllMetrics } from './metric-formulas';
import { InvestmentMetricsService } from './pipelines/investment-metrics.service';
import { MetricsPersistenceService } from './pipelines/metrics-persistence.service';
import { FiveYearGrowthService } from './pipelines/five-year-growth.service';
import { AffordabilityMetricsService } from './pipelines/affordability-metrics.service';
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from './calculated-metrics.types';

// Back-compat: keep these importable from the service path.
export type { CalculatedMetricsInput, CalculatedMetricsOutput };

@Injectable()
export class CalculatedMetricsService {
  constructor(
    private readonly investment: InvestmentMetricsService,
    private readonly persistence: MetricsPersistenceService,
    private readonly fiveYear: FiveYearGrowthService,
    private readonly affordability: AffordabilityMetricsService,
  ) {}

  /** Pure per-geography metric computation (no DB). */
  calculateAll = (input: CalculatedMetricsInput) => calculateAllMetrics(input);

  getInvestmentMetricsForMap = (
    ...args: Parameters<InvestmentMetricsService['getInvestmentMetricsForMap']>
  ) => this.investment.getInvestmentMetricsForMap(...args);

  calculateInvestmentMetricsForMetros = (year?: number) =>
    this.investment.calculateInvestmentMetricsForMetros(year);

  calculateInvestmentMetricsForCounties = (year?: number) =>
    this.investment.calculateInvestmentMetricsForCounties(year);

  calculateInvestmentMetricsForZips = (year?: number) =>
    this.investment.calculateInvestmentMetricsForZips(year);

  storeMetrics = (
    ...args: Parameters<MetricsPersistenceService['storeMetrics']>
  ) => this.persistence.storeMetrics(...args);

  getMetrics = (...args: Parameters<MetricsPersistenceService['getMetrics']>) =>
    this.persistence.getMetrics(...args);

  getMetricsForMap = (
    ...args: Parameters<MetricsPersistenceService['getMetricsForMap']>
  ) => this.persistence.getMetricsForMap(...args);

  // ============================================================================
  // 5-YEAR GROWTH BATCH CALCULATION (delegates to FiveYearGrowthService)
  // ============================================================================

  calculate5YrGrowthForAll = (year?: number) =>
    this.fiveYear.calculate5YrGrowthForAll(year);

  calculate5YrGrowthForMetros = (year?: number) =>
    this.fiveYear.calculate5YrGrowthForMetros(year);

  calculate5YrGrowthForStates = (year?: number) =>
    this.fiveYear.calculate5YrGrowthForStates(year);

  calculate5YrGrowthForCounties = () =>
    this.fiveYear.calculate5YrGrowthForCounties();

  calculate5YrGrowthForZips = () => this.fiveYear.calculate5YrGrowthForZips();

  calculate5YrGrowthForNational = (year?: number) =>
    this.fiveYear.calculate5YrGrowthForNational(year);

  get5YrGrowthForMap = (
    ...args: Parameters<FiveYearGrowthService['get5YrGrowthForMap']>
  ) => this.fiveYear.get5YrGrowthForMap(...args);

  // ============================================================================
  // INVESTMENT METRICS BATCH CALCULATION
  // ============================================================================

  calculateAllInvestmentMetrics = (year?: number) =>
    this.investment.calculateAllInvestmentMetrics(year);

  calculateAllAffordabilityMetrics = () =>
    this.affordability.calculateAllAffordabilityMetrics();

  /**
   * Single entry point for the monthly calculated_metrics refresh: investment
   * metrics + months_of_supply (all geos), overvalued_pct (all geos), 5-year
   * growth (all geos), and affordability (income_to_buy / affordable_home_price
   * / years_to_save, all geos — mortgage rate from FRED). This is the sole
   * source of truth for the monthly refresh; the old scripts/calculations
   * affordability runner is retired.
   */
  async refreshAllCalculatedMetrics(year?: number): Promise<{
    investment: { processed: number; stored: number; errors: string[] };
    overvalued: { processed: number; stored: number; errors: string[] };
    growth: { processed: number; stored: number; errors: string[] };
    affordability: {
      incomeToBuy: { processed: number; stored: number; errors: string[] };
      affordableHomePrice: {
        processed: number;
        stored: number;
        errors: string[];
      };
      yearsToSave: { processed: number; stored: number; errors: string[] };
    };
  }> {
    const inv = await this.calculateAllInvestmentMetrics(year);
    const growthRaw = await this.calculate5YrGrowthForAll(year);
    // calculate5YrGrowthForAll returns {metros,states,counties,zips,national} each {processed,stored}.
    // Aggregate across all geo levels; no error channel exists on sub-results so errors stays empty.
    const growth = {
      processed:
        growthRaw.metros.processed +
        growthRaw.states.processed +
        growthRaw.counties.processed +
        growthRaw.zips.processed +
        growthRaw.national.processed,
      stored:
        growthRaw.metros.stored +
        growthRaw.states.stored +
        growthRaw.counties.stored +
        growthRaw.zips.stored +
        growthRaw.national.stored,
      errors: [] as string[],
    };
    const affordability = await this.calculateAllAffordabilityMetrics();
    return {
      investment: inv.investmentMetrics,
      overvalued: inv.overvalued,
      growth,
      affordability,
    };
  }
}
