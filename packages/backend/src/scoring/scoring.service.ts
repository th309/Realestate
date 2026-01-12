/**
 * PropertyIQ Scoring Service
 *
 * Calculates dual scores for real estate markets:
 * - HomeReady: For homebuyers and renters (affordability, stability, value, livability, momentum)
 * - InvestorEdge: For investors (cashflow, growth, demand, entrypoint, risk)
 *
 * Scoring methodology:
 * 1. Fetch raw metrics for a geography/date
 * 2. Calculate derived metrics (GRM, YoY changes, volatility)
 * 3. Normalize metrics to percentiles (0-100 scale)
 * 4. Weight and combine into component scores
 * 5. Aggregate components into final scores
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import {
  GeographyType,
  MetricData,
  PropertyIQScore,
  HomeReadyComponents,
  InvestorEdgeComponents,
  ComponentScore,
  CalculatedMetrics,
  MetricPercentiles,
  MetricDefinition,
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
  HOMEREADY_DETAILED_METRICS,
  INVESTOREDGE_DETAILED_METRICS,
  SCORING_CONSTANTS,
} from './scoring.types';

const CALCULATION_VERSION = '1.0.0';

@Injectable()
export class ScoringService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Calculate PropertyIQ scores for a single geography
   */
  async calculateScore(
    geographyId: string,
    geographyType: GeographyType,
    periodDate?: string,
  ): Promise<PropertyIQScore | null> {
    // Default to most recent data
    const targetDate = periodDate || await this.getLatestDate(geographyType);
    if (!targetDate) return null;

    // Get geography info
    const geography = await this.getGeography(geographyId, geographyType);
    if (!geography) return null;

    // Fetch all metrics for this geography
    const metrics = await this.fetchMetrics(geography, geographyType, targetDate);
    if (Object.keys(metrics).length === 0) return null;

    // Calculate derived metrics
    const calculatedMetrics = await this.calculateDerivedMetrics(
      geographyId,
      geographyType,
      targetDate,
      metrics,
    );

    // Merge raw and calculated metrics
    const allMetrics = { ...metrics };
    if (calculatedMetrics) {
      if (calculatedMetrics.grm) allMetrics.grm = { value: calculatedMetrics.grm, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.rentPriceRatio) allMetrics.rent_yield = { value: calculatedMetrics.rentPriceRatio * 100, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.capRateProxy) allMetrics.cap_rate_proxy = { value: calculatedMetrics.capRateProxy, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.zhviYoyChange) allMetrics.zhvi_yoy = { value: calculatedMetrics.zhviYoyChange, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.zoriYoyChange) allMetrics.zori_yoy = { value: calculatedMetrics.zoriYoyChange, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.zhviStddev12m) allMetrics.zhvi_volatility = { value: calculatedMetrics.zhviStddev12m, date: targetDate, source: 'calculated' };
      if (calculatedMetrics.monthsOfSupply) allMetrics.months_supply = { value: calculatedMetrics.monthsOfSupply, date: targetDate, source: 'calculated' };
    }

    // Get percentiles for normalization
    const percentiles = await this.fetchPercentiles(geographyType, targetDate);

    // Calculate HomeReady score
    const homereadyComponents = this.calculateHomeReadyComponents(allMetrics, percentiles);
    const homereadyScore = this.aggregateScore(homereadyComponents, HOMEREADY_WEIGHTS);

    // Calculate InvestorEdge score
    const investoredgeComponents = this.calculateInvestorEdgeComponents(allMetrics, percentiles);
    const investoredgeScore = this.aggregateScore(investoredgeComponents, INVESTOREDGE_WEIGHTS);

    // Calculate trends (compare to previous month)
    const { homereadyTrend, homereadyTrendChange, investoredgeTrend, investoredgeTrendChange } =
      await this.calculateTrends(geographyId, geographyType, targetDate, homereadyScore, investoredgeScore);

    // Determine confidence level
    const metricsAvailable = Object.values(allMetrics).filter(m => m.value !== null).length;
    const metricsTotal = Object.values(HOMEREADY_DETAILED_METRICS).reduce(
      (acc, metrics) => acc + metrics.length,
      0,
    );
    const dataFreshnessDays = this.calculateFreshness(targetDate);
    const confidenceLevel = this.determineConfidence(metricsAvailable, metricsTotal, dataFreshnessDays);

    const score: PropertyIQScore = {
      geographyId,
      geographyType,
      geographyName: geography.name,
      stateCode: geography.state_code,
      periodDate: targetDate,

      homereadyScore,
      homereadyComponents,
      homereadyTrend,
      homereadyTrendChange,

      investoredgeScore,
      investoredgeComponents,
      investoredgeTrend,
      investoredgeTrendChange,

      confidenceLevel,
      metricsAvailable,
      metricsTotal,
      dataFreshnessDays,

      calculatedAt: new Date().toISOString(),
      calculationVersion: CALCULATION_VERSION,
    };

    // Save score to database
    await this.saveScore(score);

    return score;
  }

  /**
   * Calculate scores for all geographies of a given type
   */
  async calculateAllScores(
    geographyType: GeographyType,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number }> {
    const targetDate = periodDate || await this.getLatestDate(geographyType);
    if (!targetDate) return { calculated: 0, errors: 0 };

    // Get all geographies of this type
    const { data: geographies } = await this.supabase
      .from('geographies')
      .select('geography_id, name')
      .eq('geography_type', geographyType);

    if (!geographies) return { calculated: 0, errors: 0 };

    let calculated = 0;
    let errors = 0;

    for (const geo of geographies) {
      try {
        const score = await this.calculateScore(geo.geography_id, geographyType, targetDate);
        if (score) calculated++;
      } catch (err) {
        errors++;
        console.error(`Error calculating score for ${geo.geography_id}:`, err);
      }
    }

    return { calculated, errors };
  }

  /**
   * Get cached score for a geography
   */
  async getScore(
    geographyId: string,
    geographyType: GeographyType,
    periodDate?: string,
  ): Promise<PropertyIQScore | null> {
    const targetDate = periodDate || await this.getLatestDate(geographyType);
    if (!targetDate) return null;

    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .eq('period_date', targetDate)
      .single();

    if (!data) return null;

    return this.mapDbToScore(data);
  }

  // ============================================================================
  // Private: Data Fetching
  // ============================================================================

  private async getLatestDate(geographyType: GeographyType): Promise<string | null> {
    const table = this.getTableForGeography(geographyType);

    const { data } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    return data?.[0]?.period_date || null;
  }

  private getTableForGeography(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state': return 'zillow_state';
      case 'metro': return 'zillow_metro';
      case 'county': return 'zillow_county';
      case 'zip': return 'zillow_zip';
      default: return 'zillow_metro';
    }
  }

  private async getGeography(geographyId: string, geographyType: GeographyType) {
    const { data } = await this.supabase
      .from('geographies')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .single();

    return data;
  }

  private async fetchMetrics(
    geography: any,
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<MetricData> {
    const metrics: MetricData = {};
    const table = this.getTableForGeography(geographyType);

    // Get Zillow region ID for this geography
    const regionIdField = `zillow_${geographyType}_region_id`;
    const regionId = geography[regionIdField] || geography.zillow_region_id;

    if (!regionId) return metrics;

    // Fetch all metrics for this region and date
    const { data } = await this.supabase
      .from(table)
      .select('metric_name, value, period_date')
      .eq('region_id', regionId)
      .eq('period_date', periodDate);

    if (data) {
      for (const row of data) {
        metrics[row.metric_name] = {
          value: row.value,
          date: row.period_date,
          source: 'zillow',
        };
      }
    }

    return metrics;
  }

  private async fetchPercentiles(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<Map<string, MetricPercentiles>> {
    const { data } = await this.supabase
      .from('metric_percentiles')
      .select('*')
      .eq('geography_type', geographyType)
      .eq('period_date', periodDate);

    const map = new Map<string, MetricPercentiles>();

    if (data) {
      for (const row of data) {
        map.set(row.metric_name, {
          metricName: row.metric_name,
          geographyType: row.geography_type,
          periodDate: row.period_date,
          p10: row.p10,
          p20: row.p20,
          p30: row.p30,
          p40: row.p40,
          p50: row.p50,
          p60: row.p60,
          p70: row.p70,
          p80: row.p80,
          p90: row.p90,
          min: row.min_value,
          max: row.max_value,
          count: row.count_values,
          mean: row.mean_value,
          stddev: row.stddev_value,
        });
      }
    }

    return map;
  }

  // ============================================================================
  // Private: Derived Metrics Calculation
  // ============================================================================

  private async calculateDerivedMetrics(
    geographyId: string,
    geographyType: GeographyType,
    periodDate: string,
    metrics: MetricData,
  ): Promise<CalculatedMetrics | null> {
    const zhvi = metrics.zhvi?.value;
    const zori = metrics.zori?.value;

    // GRM = Home Price / Annual Rent
    const grm = zhvi && zori ? zhvi / (zori * 12) : null;

    // Rent/Price Ratio = Annual Rent / Home Price
    const rentPriceRatio = zhvi && zori ? (zori * 12) / zhvi : null;

    // Cap Rate Proxy = Rent Yield - 40% for expenses (rough estimate)
    const capRateProxy = rentPriceRatio ? rentPriceRatio * 0.6 : null;

    // Price/Rent Ratio = Home Price / Annual Rent
    const priceRentRatio = zhvi && zori ? zhvi / (zori * 12) : null;

    // YoY changes would need historical data lookup
    // For now, check if we have them in the metrics already
    const zhviYoyChange = metrics.zhvi_yoy?.value || null;
    const zoriYoyChange = metrics.zori_yoy?.value || null;
    const inventoryYoyChange = metrics.inventory_yoy?.value || null;

    // Months of supply (inventory / monthly sales rate)
    // Would need pending_sales or sales_count data
    const inventory = metrics.inventory?.value;
    const pendingSales = metrics.pending_sales?.value;
    const monthsOfSupply = inventory && pendingSales ? inventory / pendingSales : null;

    return {
      geographyId,
      geographyType,
      periodDate,
      grm,
      rentPriceRatio,
      capRateProxy,
      priceRentRatio,
      zhviYoyChange,
      zoriYoyChange,
      inventoryYoyChange,
      zhvi3yChange: null,
      zhvi5yChange: null,
      zhvi90dChange: null,
      zori90dChange: null,
      inventory90dChange: null,
      dom90dChange: null,
      zhviStddev12m: null,
      zhviStddev36m: null,
      zoriStddev12m: null,
      inventoryStddev12m: null,
      domStddev12m: null,
      monthsOfSupply,
    };
  }

  // ============================================================================
  // Private: Score Calculation
  // ============================================================================

  private calculateHomeReadyComponents(
    metrics: MetricData,
    percentiles: Map<string, MetricPercentiles>,
  ): Record<keyof HomeReadyComponents, ComponentScore> {
    const components: Record<keyof HomeReadyComponents, ComponentScore> = {
      affordability: this.calculateComponentWithDefinitions(HOMEREADY_DETAILED_METRICS.affordability, metrics, percentiles),
      stability: this.calculateComponentWithDefinitions(HOMEREADY_DETAILED_METRICS.stability, metrics, percentiles),
      value: this.calculateComponentWithDefinitions(HOMEREADY_DETAILED_METRICS.value, metrics, percentiles),
      livability: this.calculateComponentWithDefinitions(HOMEREADY_DETAILED_METRICS.livability, metrics, percentiles),
      momentum: this.calculateComponentWithDefinitions(HOMEREADY_DETAILED_METRICS.momentum, metrics, percentiles),
    };

    return components;
  }

  private calculateInvestorEdgeComponents(
    metrics: MetricData,
    percentiles: Map<string, MetricPercentiles>,
  ): Record<keyof InvestorEdgeComponents, ComponentScore> {
    const components: Record<keyof InvestorEdgeComponents, ComponentScore> = {
      cashflow: this.calculateComponentWithDefinitions(INVESTOREDGE_DETAILED_METRICS.cashflow, metrics, percentiles),
      growth: this.calculateComponentWithDefinitions(INVESTOREDGE_DETAILED_METRICS.growth, metrics, percentiles),
      demand: this.calculateComponentWithDefinitions(INVESTOREDGE_DETAILED_METRICS.demand, metrics, percentiles),
      entrypoint: this.calculateComponentWithDefinitions(INVESTOREDGE_DETAILED_METRICS.entrypoint, metrics, percentiles),
      risk: this.calculateComponentWithDefinitions(INVESTOREDGE_DETAILED_METRICS.risk, metrics, percentiles),
    };

    return components;
  }

  private calculateComponentWithDefinitions(
    metricDefinitions: MetricDefinition[],
    metrics: MetricData,
    percentiles: Map<string, MetricPercentiles>,
  ): ComponentScore {
    const metricsUsed: string[] = [];
    const helpingFactors: string[] = [];
    const hurtingFactors: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    for (const metricDef of metricDefinitions) {
      const metric = metrics[metricDef.name];
      const percentile = percentiles.get(metricDef.name);

      // Handle null/missing values based on nullStrategy
      if (!metric || metric.value === null) {
        switch (metricDef.nullStrategy) {
          case 'skip':
            // Don't include in calculation
            continue;
          case 'neutral':
            // Include at neutral score (50)
            totalWeight += metricDef.weight;
            weightedSum += 50 * metricDef.weight;
            continue;
          case 'penalize':
            // Include at low score (25) for penalty
            totalWeight += metricDef.weight;
            weightedSum += 25 * metricDef.weight;
            continue;
        }
      }

      // Skip if no percentile data available
      if (!percentile) {
        if (metricDef.nullStrategy === 'penalize') {
          totalWeight += metricDef.weight;
          weightedSum += 25 * metricDef.weight;
        }
        continue;
      }

      // Normalize value to 0-100 percentile
      const normalizedScore = this.valueToPercentile(metric.value!, percentile);

      // Apply direction transformation
      let adjustedScore: number;
      switch (metricDef.direction) {
        case 'higher_better':
          adjustedScore = normalizedScore;
          break;
        case 'lower_better':
          adjustedScore = 100 - normalizedScore;
          break;
        case 'moderate_better':
          // Score highest at 50th percentile, drops off on both ends
          const deviation = Math.abs(normalizedScore - SCORING_CONSTANTS.MODERATE_TARGET_PERCENTILE);
          adjustedScore = 100 - (deviation * 2);
          break;
        case 'neutral':
        default:
          adjustedScore = 50; // Neutral contribution
          break;
      }

      // Clamp to valid range
      adjustedScore = Math.max(SCORING_CONSTANTS.MIN_SCORE, Math.min(SCORING_CONSTANTS.MAX_SCORE, adjustedScore));

      // Use the defined weight for this metric
      totalWeight += metricDef.weight;
      weightedSum += adjustedScore * metricDef.weight;
      metricsUsed.push(metricDef.name);

      // Track helping/hurting factors
      if (adjustedScore >= 70) {
        helpingFactors.push(metricDef.name);
      } else if (adjustedScore <= 30) {
        hurtingFactors.push(metricDef.name);
      }
    }

    // Calculate final score (default to 50 if no data)
    const score = totalWeight > 0 ? weightedSum / totalWeight : 50;

    return {
      score: Math.round(score * 100) / 100,
      weight: 1, // Will be set by caller
      weightedContribution: 0, // Will be calculated by aggregator
      metricsUsed,
      helpingFactors,
      hurtingFactors,
    };
  }

  private valueToPercentile(value: number, percentiles: MetricPercentiles): number {
    // Find which percentile bucket the value falls into
    if (value <= percentiles.p10) return 10;
    if (value <= percentiles.p20) return 20;
    if (value <= percentiles.p30) return 30;
    if (value <= percentiles.p40) return 40;
    if (value <= percentiles.p50) return 50;
    if (value <= percentiles.p60) return 60;
    if (value <= percentiles.p70) return 70;
    if (value <= percentiles.p80) return 80;
    if (value <= percentiles.p90) return 90;
    return 95;
  }

  private aggregateScore<T extends string>(
    components: Record<T, ComponentScore>,
    weights: Record<T, number>,
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, component] of Object.entries(components) as [T, ComponentScore][]) {
      const weight = weights[key];
      component.weight = weight;
      component.weightedContribution = component.score * weight;

      weightedSum += component.weightedContribution;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 50;
  }

  // ============================================================================
  // Private: Trend Calculation
  // ============================================================================

  private async calculateTrends(
    geographyId: string,
    geographyType: GeographyType,
    currentDate: string,
    currentHomeready: number,
    currentInvestoredge: number,
  ) {
    // Get score from 6 months ago for trend calculation
    const trendDate = this.getDateMonthsAgo(currentDate, SCORING_CONSTANTS.TREND_MONTHS);

    const { data: previousScore } = await this.supabase
      .from('propertyiq_scores')
      .select('homeready_score, investoredge_score')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .eq('period_date', trendDate)
      .single();

    let homereadyTrend: 'up' | 'down' | 'stable' = 'stable';
    let homereadyTrendChange = 0;
    let investoredgeTrend: 'up' | 'down' | 'stable' = 'stable';
    let investoredgeTrendChange = 0;

    if (previousScore) {
      homereadyTrendChange = currentHomeready - previousScore.homeready_score;
      investoredgeTrendChange = currentInvestoredge - previousScore.investoredge_score;

      // Use configurable threshold for trend classification
      const threshold = SCORING_CONSTANTS.TREND_THRESHOLD;
      homereadyTrend = homereadyTrendChange > threshold ? 'up' : homereadyTrendChange < -threshold ? 'down' : 'stable';
      investoredgeTrend = investoredgeTrendChange > threshold ? 'up' : investoredgeTrendChange < -threshold ? 'down' : 'stable';
    }

    return { homereadyTrend, homereadyTrendChange, investoredgeTrend, investoredgeTrendChange };
  }

  private getDateMonthsAgo(date: string, months: number): string {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  }

  // ============================================================================
  // Private: Helpers
  // ============================================================================

  private determineConfidence(
    available: number,
    total: number,
    freshnessDays: number
  ): 'high' | 'medium' | 'low' {
    const ratio = available / total;

    // High: ≥90% metrics AND <60 days old
    if (ratio >= SCORING_CONSTANTS.HIGH_CONFIDENCE_METRICS_PCT &&
        freshnessDays < SCORING_CONSTANTS.HIGH_CONFIDENCE_FRESHNESS_DAYS) {
      return 'high';
    }

    // Medium: ≥70% metrics AND <120 days old
    if (ratio >= SCORING_CONSTANTS.MEDIUM_CONFIDENCE_METRICS_PCT &&
        freshnessDays < SCORING_CONSTANTS.MEDIUM_CONFIDENCE_FRESHNESS_DAYS) {
      return 'medium';
    }

    return 'low';
  }

  private calculateFreshness(periodDate: string): number {
    const dataDate = new Date(periodDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dataDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ============================================================================
  // Private: Database Operations
  // ============================================================================

  private async saveScore(score: PropertyIQScore): Promise<void> {
    const { error } = await this.supabase
      .from('propertyiq_scores')
      .upsert({
        geography_id: score.geographyId,
        geography_type: score.geographyType,
        geography_name: score.geographyName,
        state_code: score.stateCode,
        period_date: score.periodDate,

        homeready_score: score.homereadyScore,
        homeready_affordability: score.homereadyComponents.affordability.score,
        homeready_stability: score.homereadyComponents.stability.score,
        homeready_value: score.homereadyComponents.value.score,
        homeready_livability: score.homereadyComponents.livability.score,
        homeready_momentum: score.homereadyComponents.momentum.score,
        homeready_trend: score.homereadyTrend,
        homeready_trend_change: score.homereadyTrendChange,

        investoredge_score: score.investoredgeScore,
        investoredge_cashflow: score.investoredgeComponents.cashflow.score,
        investoredge_growth: score.investoredgeComponents.growth.score,
        investoredge_demand: score.investoredgeComponents.demand.score,
        investoredge_entrypoint: score.investoredgeComponents.entrypoint.score,
        investoredge_risk: score.investoredgeComponents.risk.score,
        investoredge_trend: score.investoredgeTrend,
        investoredge_trend_change: score.investoredgeTrendChange,

        confidence_level: score.confidenceLevel,
        metrics_available: score.metricsAvailable,
        metrics_total: score.metricsTotal,
        data_freshness_days: score.dataFreshnessDays,

        calculated_at: score.calculatedAt,
        calculation_version: score.calculationVersion,
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

    if (error) {
      console.error('Error saving PropertyIQ score:', error);
    }

    // Save detailed component scores for Pro tier
    await this.saveScoreDetails(score);
  }

  private async saveScoreDetails(score: PropertyIQScore): Promise<void> {
    // Get the score ID
    const { data: scoreRecord } = await this.supabase
      .from('propertyiq_scores')
      .select('id')
      .eq('geography_id', score.geographyId)
      .eq('geography_type', score.geographyType)
      .eq('period_date', score.periodDate)
      .single();

    if (!scoreRecord) return;

    // Delete existing details
    await this.supabase
      .from('propertyiq_score_details')
      .delete()
      .eq('score_id', scoreRecord.id);

    // Insert HomeReady component details
    for (const [component, data] of Object.entries(score.homereadyComponents)) {
      await this.supabase
        .from('propertyiq_score_details')
        .insert({
          score_id: scoreRecord.id,
          score_type: 'homeready',
          component,
          component_score: data.score,
          component_weight: data.weight,
          weighted_contribution: data.weightedContribution,
          metrics: { used: data.metricsUsed },
          helping_factors: data.helpingFactors,
          hurting_factors: data.hurtingFactors,
        });
    }

    // Insert InvestorEdge component details
    for (const [component, data] of Object.entries(score.investoredgeComponents)) {
      await this.supabase
        .from('propertyiq_score_details')
        .insert({
          score_id: scoreRecord.id,
          score_type: 'investoredge',
          component,
          component_score: data.score,
          component_weight: data.weight,
          weighted_contribution: data.weightedContribution,
          metrics: { used: data.metricsUsed },
          helping_factors: data.helpingFactors,
          hurting_factors: data.hurtingFactors,
        });
    }
  }

  private mapDbToScore(data: any): PropertyIQScore {
    return {
      geographyId: data.geography_id,
      geographyType: data.geography_type,
      geographyName: data.geography_name,
      stateCode: data.state_code,
      periodDate: data.period_date,

      homereadyScore: data.homeready_score,
      homereadyComponents: {
        affordability: { score: data.homeready_affordability, weight: HOMEREADY_WEIGHTS.affordability, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        stability: { score: data.homeready_stability, weight: HOMEREADY_WEIGHTS.stability, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        value: { score: data.homeready_value, weight: HOMEREADY_WEIGHTS.value, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        livability: { score: data.homeready_livability, weight: HOMEREADY_WEIGHTS.livability, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        momentum: { score: data.homeready_momentum, weight: HOMEREADY_WEIGHTS.momentum, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
      },
      homereadyTrend: data.homeready_trend || 'stable',
      homereadyTrendChange: data.homeready_trend_change || 0,

      investoredgeScore: data.investoredge_score,
      investoredgeComponents: {
        cashflow: { score: data.investoredge_cashflow, weight: INVESTOREDGE_WEIGHTS.cashflow, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        growth: { score: data.investoredge_growth, weight: INVESTOREDGE_WEIGHTS.growth, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        demand: { score: data.investoredge_demand, weight: INVESTOREDGE_WEIGHTS.demand, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        entrypoint: { score: data.investoredge_entrypoint, weight: INVESTOREDGE_WEIGHTS.entrypoint, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
        risk: { score: data.investoredge_risk, weight: INVESTOREDGE_WEIGHTS.risk, weightedContribution: 0, metricsUsed: [], helpingFactors: [], hurtingFactors: [] },
      },
      investoredgeTrend: data.investoredge_trend || 'stable',
      investoredgeTrendChange: data.investoredge_trend_change || 0,

      confidenceLevel: data.confidence_level,
      metricsAvailable: data.metrics_available,
      metricsTotal: data.metrics_total,
      dataFreshnessDays: data.data_freshness_days,

      calculatedAt: data.calculated_at,
      calculationVersion: data.calculation_version,
    };
  }
}
