/**
 * PropertyIQ Reports Service
 *
 * Handles report generation pipeline:
 * 1. Validation and template loading
 * 2. Data assembly from various sources
 * 3. AI narrative generation
 * 4. Report storage and retrieval
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { ClaudeService } from './claude.service';
import { GeminiNewsService } from './gemini-news.service';
import { TimeSeriesService, TimeSeriesDataPoint } from '../timeseries/timeseries.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { randomBytes } from 'crypto';
import { HISTORY_MONTHS_MAX } from '../common/history.constants';

export interface ReportTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  version: number;
  tier_required: string;
  config: any;
}

/**
 * Score contextualization - provides human-readable interpretation of scores
 */
export interface ScoreContext {
  /** Human-readable interpretation (e.g., "Excellent buying conditions") */
  interpretation: string;
  /** Percentile comparison text (e.g., "Top 15% of metros in your price range") */
  percentile_text: string;
  /** Practical dollar impact (e.g., "Historically, homes in similar markets appreciated...") */
  dollar_impact?: string;
  /** Comparison to other areas (e.g., "Better than 85% of comparable areas") */
  comparison?: string;
}

/**
 * Score type definitions for contextualization
 */
type ScoreType = 'homeready' | 'investoredge' | 'markethealth';

/** Historical data for a single metric */
export interface HistoricalMetricData {
  data: Array<{ date: string; value: number }>;
  trend: 'up' | 'down' | 'stable';
  change_pct: number;
}

/** Historical data collection for all metrics */
export interface HistoricalData {
  [metricId: string]: HistoricalMetricData;
}

/** Priority score breakdown for a single priority */
export interface PriorityScore {
  priority: string;
  weight: number;
  winnerId: string;
  winnerName: string;
  keyMetric: string;
  winnerValue: number | null;
  loserValue: number | null;
  reason: string;
}

/** Result of priority-weighted winner calculation */
export interface PriorityWeightedResult {
  winnerId: string;
  winnerName: string;
  totalScore: number;
  priorityScores: PriorityScore[];
  reasons: string[];
}

/** Market metrics for AI context - matches template placeholders */
export interface MarketMetrics {
  // Price metrics (Zillow)
  zhvi?: number;
  zhvi_yoy?: number;
  zhvi_3y_cagr?: number;
  zhvi_5y_cagr?: number;
  zhvf_1yr_pct?: number; // 1-year forecast

  // Rent metrics (Zillow)
  zori?: number;
  zori_yoy?: number;
  zori_5y_cagr?: number;
  zordi?: number; // Rental demand index

  // Market activity (Realtor)
  market_heat_index?: number; // alias for hotness_score
  hotness_score?: number;
  demand_score?: number;
  days_to_pending?: number;
  days_on_market?: number;
  for_sale_inventory?: number;
  active_listing_count?: number;
  inventory_yoy?: number;
  new_listings?: number;
  pending_ratio?: number;
  price_reduced_share?: number;
  price_cut_pct?: number;
  sale_to_list_ratio?: number;
  months_of_supply?: number;
  median_listing_price?: number;
  median_listing_price_yoy?: number;

  // Investment metrics (Calculated)
  cap_rate?: number;
  cap_rate_proxy?: number;
  gross_yield?: number;
  gross_rent_multiplier?: number;
  grm?: number;
  rent_to_price_ratio?: number;
  overvalued_pct?: number;
  affordability_index?: number;
  affordability_ratio?: number;
  affordability_gap?: number;
  income_needed_to_buy?: number;
  income_percentile_to_buy?: number;
  rent_to_income_ratio?: number;

  // Census/Economic data
  median_household_income?: number;
  median_income?: number;
  population?: number;
  population_growth_yoy?: number;
  population_yoy?: number;
  unemployment_rate?: number;
  job_growth_yoy?: number;
  income_growth_yoy?: number;
  net_migration?: number;
  median_age?: number;
  homeownership_rate?: number;
  remote_work_pct?: number;

  // Historical comparisons
  zhvi_vs_2007_peak?: number;
  zhvi_vs_2012_trough?: number;
  zhvi_vs_pre_covid?: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
    private readonly geminiNewsService: GeminiNewsService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Get available report templates
   */
  async getTemplates(tier?: string): Promise<ReportTemplate[]> {
    const client = this.supabase.getClient();
    const query = client
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('tier_required', { ascending: true });

    const { data, error } = await query;
    if (error) {
      this.logger.error('Failed to fetch templates:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Get template by slug
   */
  async getTemplateBySlug(slug: string): Promise<ReportTemplate | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('report_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch template ${slug}:`, error);
      return null;
    }
    return data;
  }

  /**
   * Generate a new report
   */
  async generateReport(
    userId: string,
    dto: GenerateReportDto,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const startTime = Date.now();

    // 1. Load template
    const template = await this.getTemplateBySlug(dto.template_slug);
    if (!template) {
      throw new Error(`Template not found: ${dto.template_slug}`);
    }

    // 2. Create report record in 'pending' status
    const reportTitle = this.generateReportTitle(
      template.name,
      dto.primary_geography.name,
    );

    const { data: report, error: insertError } = await client
      .from('reports')
      .insert({
        user_id: userId,
        template_id: template.id,
        template_version: template.version,
        report_type: template.slug,
        title: reportTitle,
        user_type: dto.user_type,
        primary_geography_id: dto.primary_geography.id,
        primary_geography_type: dto.primary_geography.type,
        primary_geography_name: dto.primary_geography.name,
        comparison_geographies: dto.comparison_geographies || null,
        user_inputs: {
          ...dto.user_inputs,
          priorities: dto.priorities || [],
        },
        status: 'generating',
        generation_started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !report) {
      this.logger.error('Failed to create report:', insertError);
      throw new Error('Failed to create report');
    }

    // 3. Kick off async generation (in background)
    this.generateReportAsync(report.id, template, dto, startTime, userId);

    return report.id;
  }

  /**
   * Async report generation pipeline
   */
  private async generateReportAsync(
    reportId: string,
    template: ReportTemplate,
    dto: GenerateReportDto,
    startTime: number,
    userId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    try {
      // 1. Fetch PropertyIQ scores
      // Map geography type to GeographyLevel (metro, county, zip)
      const geoType = dto.primary_geography.type as 'metro' | 'county' | 'zip';
      const scores = await this.scoringService.getScore(
        dto.primary_geography.id,
        geoType,
      );

      // 1b. Fetch market metrics for AI context (based on template requirements)
      // Include demographics if specified in template
      const requiredMetrics = template.config?.data_requirements?.current_metrics || [];
      const demographics = template.config?.data_requirements?.demographics || [];
      const allRequiredMetrics = [...requiredMetrics, ...demographics, 'census', 'population', 'median_income'];
      const marketMetrics = await this.fetchMarketMetrics(
        dto.primary_geography.id,
        geoType,
        allRequiredMetrics,
      );

      // 1c. Fetch historical data for key metrics (last 6 months)
      const historicalData = await this.fetchHistoricalData(
        dto.primary_geography.id,
        geoType,
      );

      // 1d. Fetch comparison geography data
      const comparisons: Record<string, any> = {};
      if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
        for (const compGeo of dto.comparison_geographies) {
          const compGeoType = compGeo.type as 'metro' | 'county' | 'zip';
          const compMetrics = await this.fetchMarketMetrics(
            compGeo.id,
            compGeoType,
            allRequiredMetrics,
          );
          const compHistorical = await this.fetchHistoricalData(
            compGeo.id,
            compGeoType,
          );
          const compScores = await this.scoringService.getScore(
            compGeo.id,
            compGeoType,
          );

          comparisons[compGeo.id] = {
            geography: compGeo,
            current: compMetrics,
            historical: compHistorical,
            scores: compScores,
          };
        }
      }

      // 2. Scout news via Gemini (with caching)
      const newsResult = await this.geminiNewsService.getOrScoutNews(
        dto.primary_geography.id,
        geoType,
        dto.primary_geography.name,
        dto.primary_geography.state || '',
        {
          includeNationalContext: true,
          maxNewsItems: 10,
          lookbackDays: 90,
        },
      );

      // Get signal summary if news available
      const signalSummary = newsResult
        ? this.geminiNewsService.summarizeSignals(newsResult)
        : null;

      // 2b. Generate score contexts for human-readable interpretations
      const scoreContexts = scores
        ? this.generateAllScoreContexts(
            {
              homeready: scores.scores.homeready,
              investoredge: scores.scores.investoredge,
              markethealth: scores.scores.markethealth,
            },
            {
              geography_type: geoType,
              median_price: marketMetrics.median_listing_price || marketMetrics.zhvi,
            },
          )
        : null;

      // 3. Assemble report data
      const populatedData = {
        current: {
          zhvi: marketMetrics.zhvi,
          zhvi_yoy: marketMetrics.zhvi_yoy,
          median_listing_price: marketMetrics.median_listing_price,
          median_listing_price_yoy: marketMetrics.median_listing_price_yoy,
          zori: marketMetrics.zori,
          days_on_market: marketMetrics.days_on_market,
          active_listing_count: marketMetrics.active_listing_count,
          inventory_yoy: marketMetrics.inventory_yoy,
          hotness_score: marketMetrics.hotness_score,
          demand_score: marketMetrics.demand_score,
          cap_rate: marketMetrics.cap_rate,
          gross_yield: marketMetrics.gross_yield,
          grm: marketMetrics.grm,
          overvalued_pct: marketMetrics.overvalued_pct,
          median_income: marketMetrics.median_income,
          population: marketMetrics.population,
        },
        historical: historicalData,
        benchmarks: {},
        scores: {
          homeready: scores
            ? {
                score: scores.scores.homeready.score,
                grade: scores.scores.homeready.grade,
                trend: 'stable',
                context: scoreContexts?.homeready || undefined,
              }
            : undefined,
          investoredge: scores
            ? {
                score: scores.scores.investoredge.score,
                grade: scores.scores.investoredge.grade,
                trend: 'stable',
                context: scoreContexts?.investoredge || undefined,
              }
            : undefined,
          markethealth: scores
            ? {
                score: scores.scores.markethealth.score,
                grade: scores.scores.markethealth.grade,
                trend: 'stable',
                context: scoreContexts?.markethealth || undefined,
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

      // 3b. Calculate priority-weighted winner for comparison reports
      const priorities = dto.priorities || dto.user_inputs?.priorities || [];
      let priorityWeightedWinner: PriorityWeightedResult | null = null;

      if (priorities.length > 0 && dto.comparison_geographies && dto.comparison_geographies.length > 0) {
        const comparisonMarketData = dto.comparison_geographies.map(compGeo => ({
          geography: { id: compGeo.id, name: compGeo.name },
          metrics: comparisons[compGeo.id]?.current || {},
          scores: comparisons[compGeo.id]?.scores,
        }));

        priorityWeightedWinner = this.calculatePriorityWeightedWinner(
          {
            geography: { id: dto.primary_geography.id, name: dto.primary_geography.name },
            metrics: marketMetrics,
            scores,
          },
          comparisonMarketData,
          priorities,
          dto.user_type,
        );

        // Add winner data to populatedData
        if (priorityWeightedWinner) {
          (populatedData as any).priority_weighted_winner = priorityWeightedWinner;
        }
      }

      // Store priorities in populated data for reference
      (populatedData as any).priorities = priorities;

      // 4. Generate AI narratives (Claude) with news context — only for entitled users
      let aiNarratives = {};
      const aiAccess = await this.entitlementsService.checkAccess(userId, null, ['feature:ai_insights']);
      const hasAiInsights = aiAccess.access['feature:ai_insights']?.level === 'full';

      if (!hasAiInsights) {
        this.logger.log(`[Report] Skipping AI narratives — user ${userId} does not have ai_insights`);
      }

      if (hasAiInsights && template.config.ai_config?.narrative_sections) {
        // Format news for Claude prompt context
        const newsContext = newsResult
          ? this.geminiNewsService.formatNewsForPrompt(newsResult, {
              maxNewsItems: 5,
              includeIndicators: true,
              includeSignals: true,
              includeNational: true,
            })
          : 'No recent news available for this market.';

        aiNarratives = await this.claudeService.generateNarratives(
          template.config.ai_config.narrative_sections,
          {
            // Basic info - templates use both {{geography_name}} and {{primary_geography_name}}
            geography_name: dto.primary_geography.name,
            primary_geography_name: dto.primary_geography.name,
            geography_type: dto.primary_geography.type,
            user_type: dto.user_type,

            // Scores (formatted for display) - templates use {{homeready_score}} etc.
            homeready_score: scores ? Math.round(scores.scores.homeready.score) : 'N/A',
            investoredge_score: scores ? Math.round(scores.scores.investoredge.score) : 'N/A',
            markethealth_score: scores ? Math.round(scores.scores.markethealth.score) : 'N/A',
            homeready_grade: scores?.scores.homeready.grade || 'N/A',
            investoredge_grade: scores?.scores.investoredge.grade || 'N/A',

            // Price metrics - templates use {{zhvi}} (currency) and {{zhvi_yoy}} (number, adds % in template)
            zhvi: this.formatCurrency(marketMetrics.zhvi),
            zhvi_yoy: marketMetrics.zhvi_yoy?.toFixed(1) ?? 'N/A',
            zhvi_3y_cagr: marketMetrics.zhvi_3y_cagr?.toFixed(1) ?? 'N/A',
            zhvi_5y_cagr: marketMetrics.zhvi_5y_cagr?.toFixed(1) ?? 'N/A',
            zhvf_1yr_pct: marketMetrics.zhvf_1yr_pct?.toFixed(1) ?? 'N/A',
            median_listing_price: this.formatCurrency(marketMetrics.median_listing_price),

            // Rent metrics - templates use {{zori}} as currency
            zori: this.formatCurrency(marketMetrics.zori),
            zori_yoy: marketMetrics.zori_yoy?.toFixed(1) ?? 'N/A',
            zori_5y_cagr: marketMetrics.zori_5y_cagr?.toFixed(1) ?? 'N/A',

            // Market activity - templates use these exact names
            market_heat_index: marketMetrics.market_heat_index ?? marketMetrics.hotness_score ?? 'N/A',
            hotness_score: marketMetrics.hotness_score ?? 'N/A',
            demand_score: marketMetrics.demand_score ?? 'N/A',
            days_to_pending: marketMetrics.days_to_pending ?? marketMetrics.days_on_market ?? 'N/A',
            days_on_market: marketMetrics.days_on_market ?? 'N/A',
            for_sale_inventory: marketMetrics.for_sale_inventory ?? marketMetrics.active_listing_count ?? 'N/A',
            active_listing_count: marketMetrics.active_listing_count ?? 'N/A',
            inventory_yoy: marketMetrics.inventory_yoy?.toFixed(1) ?? 'N/A',
            new_listings: marketMetrics.new_listings ?? 'N/A',
            pending_ratio: marketMetrics.pending_ratio ? (marketMetrics.pending_ratio * 100).toFixed(1) : 'N/A',
            price_cut_pct: marketMetrics.price_cut_pct ?? marketMetrics.price_reduced_share ? ((marketMetrics.price_cut_pct ?? marketMetrics.price_reduced_share ?? 0) * 100).toFixed(1) : 'N/A',
            sale_to_list_ratio: marketMetrics.sale_to_list_ratio?.toFixed(1) ?? 'N/A',
            months_of_supply: marketMetrics.months_of_supply?.toFixed(1) ?? 'N/A',

            // Investment metrics - templates use these
            gross_rent_multiplier: marketMetrics.gross_rent_multiplier ?? marketMetrics.grm ?? 'N/A',
            rent_to_price_ratio: marketMetrics.rent_to_price_ratio?.toFixed(2) ?? 'N/A',
            cap_rate_proxy: marketMetrics.cap_rate_proxy ?? marketMetrics.cap_rate ?? 'N/A',
            cap_rate: marketMetrics.cap_rate?.toFixed(2) ?? 'N/A',
            gross_yield: marketMetrics.gross_yield?.toFixed(2) ?? 'N/A',
            grm: marketMetrics.grm?.toFixed(1) ?? 'N/A',
            zordi: marketMetrics.zordi ?? 'N/A',
            rent_to_income_ratio: marketMetrics.rent_to_income_ratio?.toFixed(1) ?? 'N/A',

            // Affordability metrics
            affordability_index: marketMetrics.affordability_index ?? 'N/A',
            affordability_gap: marketMetrics.affordability_gap ? this.formatCurrency(marketMetrics.affordability_gap) : 'N/A',
            income_needed_to_buy: marketMetrics.income_needed_to_buy ? this.formatCurrency(marketMetrics.income_needed_to_buy) : 'N/A',
            income_percentile_to_buy: marketMetrics.income_percentile_to_buy ?? 'N/A',

            // Economic/Census data - templates use these names
            median_household_income: this.formatCurrency(marketMetrics.median_household_income ?? marketMetrics.median_income),
            median_income: this.formatCurrency(marketMetrics.median_income),
            population: marketMetrics.population?.toLocaleString() ?? 'N/A',
            population_growth_yoy: marketMetrics.population_growth_yoy?.toFixed(1) ?? 'N/A',
            unemployment_rate: marketMetrics.unemployment_rate?.toFixed(1) ?? 'N/A',
            job_growth_yoy: marketMetrics.job_growth_yoy?.toFixed(1) ?? 'N/A',
            income_growth_yoy: marketMetrics.income_growth_yoy?.toFixed(1) ?? 'N/A',
            net_migration: marketMetrics.net_migration?.toLocaleString() ?? 'N/A',
            median_age: marketMetrics.median_age ?? 'N/A',
            homeownership_rate: marketMetrics.homeownership_rate?.toFixed(1) ?? 'N/A',
            remote_work_pct: marketMetrics.remote_work_pct?.toFixed(1) ?? 'N/A',

            // Historical comparisons for cycle analysis
            zhvi_vs_2007_peak: marketMetrics.zhvi_vs_2007_peak?.toFixed(1) ?? 'N/A',
            zhvi_vs_2012_trough: marketMetrics.zhvi_vs_2012_trough?.toFixed(1) ?? 'N/A',
            zhvi_vs_pre_covid: marketMetrics.zhvi_vs_pre_covid?.toFixed(1) ?? 'N/A',

            // Full objects for complex analysis
            scores,
            market_metrics: marketMetrics,
            news_context: newsContext,
            market_signal_summary: signalSummary
              ? `Overall market signal: ${signalSummary.overall.toUpperCase()} (${signalSummary.bullish_count} bullish, ${signalSummary.bearish_count} bearish signals)`
              : null,
            // Score context for AI narratives
            homeready_context: scoreContexts?.homeready?.interpretation || null,
            homeready_comparison: scoreContexts?.homeready?.comparison || null,
            homeready_impact: scoreContexts?.homeready?.dollar_impact || null,
            investoredge_context: scoreContexts?.investoredge?.interpretation || null,
            investoredge_comparison: scoreContexts?.investoredge?.comparison || null,
            investoredge_impact: scoreContexts?.investoredge?.dollar_impact || null,
            markethealth_context: scoreContexts?.markethealth?.interpretation || null,
            markethealth_comparison: scoreContexts?.markethealth?.comparison || null,
            markethealth_impact: scoreContexts?.markethealth?.dollar_impact || null,

            // Priority and comparison context for comparison reports
            priorities: priorities,
            priorities_formatted: priorities.length > 0
              ? priorities.map((p, i) => `${i + 1}. ${this.formatPriorityName(p)}`).join(', ')
              : 'No priorities specified',
            priority_weighted_winner: priorityWeightedWinner,
            winner_name: priorityWeightedWinner?.winnerName || null,
            winner_reasons: priorityWeightedWinner?.reasons || [],
            comparison_markets: dto.comparison_geographies?.map(g => ({
              id: g.id,
              name: g.name,
              metrics: comparisons[g.id]?.current,
              scores: comparisons[g.id]?.scores,
            })) || [],

            ...dto.user_inputs,
          },
        );
      }

      // 5. Update report with completed data
      const generationTime = Date.now() - startTime;
      const { error: updateError } = await client
        .from('reports')
        .update({
          status: 'ready',
          populated_data: populatedData,
          ai_narrative: aiNarratives,
          ai_model_used: 'claude-sonnet-4-20250514',
          homeready_score: scores?.scores.homeready.score != null ? Math.round(scores.scores.homeready.score) : null,
          investoredge_score: scores?.scores.investoredge.score != null ? Math.round(scores.scores.investoredge.score) : null,
          scores_snapshot: scores,
          generation_completed_at: new Date().toISOString(),
          generation_time_ms: generationTime,
          data_as_of_date: new Date().toISOString().split('T')[0],
          confidence_level: 'high',
        })
        .eq('id', reportId);

      if (updateError) {
        throw updateError;
      }

      this.logger.log(`Report ${reportId} generated in ${generationTime}ms`);
    } catch (error) {
      this.logger.error(`Report generation failed for ${reportId}:`, error);

      // Mark report as failed
      await client
        .from('reports')
        .update({
          status: 'failed',
          error_message: error.message || 'Unknown error during generation',
        })
        .eq('id', reportId);
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string, userId?: string): Promise<any> {
    const client = this.supabase.getClient();
    let query = client
      .from('reports')
      .select(
        `
        *,
        template:report_templates(slug, name, icon, config)
      `,
      )
      .eq('id', reportId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();
    if (error) {
      this.logger.error(`Failed to fetch report ${reportId}:`, error);
      return null;
    }

    // Update last viewed
    await client
      .from('reports')
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('id', reportId);

    return data;
  }

  /**
   * Get user's report history
   */
  async getReportHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('reports')
      .select(
        `
        id,
        title,
        report_type,
        user_type,
        primary_geography_name,
        primary_geography_type,
        homeready_score,
        investoredge_score,
        status,
        data_as_of_date,
        created_at,
        template:report_templates(slug, name, icon)
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to fetch report history:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to delete report ${reportId}:`, error);
      return false;
    }
    return true;
  }

  /**
   * Send conversation message
   */
  async sendConversationMessage(
    reportId: string,
    userId: string,
    content: string,
  ): Promise<any> {
    const client = this.supabase.getClient();

    // Get or create conversation
    let { data: conversation } = await client
      .from('report_conversations')
      .select('*')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .single();

    if (!conversation) {
      const { data: newConv, error } = await client
        .from('report_conversations')
        .insert({
          report_id: reportId,
          user_id: userId,
          messages: [],
          exchange_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      conversation = newConv;
    }

    // Get report for context
    const report = await this.getReport(reportId, userId);

    // Extract news context from report's realtime data if available
    let newsContext: string | undefined;
    const realtimeData = report.populated_data?.realtime;
    if (realtimeData && realtimeData.news && realtimeData.news.length > 0) {
      // Format news for conversation context using the same format as narrative generation
      const newsResult = {
        local_news: realtimeData.news,
        economic_indicators: realtimeData.indicators || [],
        market_signals: realtimeData.signals || [],
        national_context: realtimeData.national_context,
      };
      newsContext = this.geminiNewsService.formatNewsForPrompt(newsResult as any, {
        maxNewsItems: 5,
        includeIndicators: true,
        includeSignals: true,
        includeNational: true,
      });
    }

    // Check AI entitlement before generating conversation response
    const convAiAccess = await this.entitlementsService.checkAccess(userId, null, ['feature:ai_insights']);
    if (convAiAccess.access['feature:ai_insights']?.level !== 'full') {
      return {
        messages: [
          ...(conversation.messages || []),
          {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
          },
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'AI-powered conversation requires an Enterprise plan. Upgrade to unlock AI chat for your reports.',
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    // Generate AI response
    const response = await this.claudeService.generateConversationResponse(
      content,
      conversation.messages || [],
      report,
      newsContext,
    );

    // Update conversation
    const messages = [
      ...(conversation.messages || []),
      {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      },
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      },
    ];

    await client
      .from('report_conversations')
      .update({
        messages,
        exchange_count: (conversation.exchange_count || 0) + 1,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    return {
      response,
      exchange_count: (conversation.exchange_count || 0) + 1,
      limit_reached: false,
    };
  }

  /**
   * Get conversation for a report
   */
  async getConversation(reportId: string, userId: string): Promise<any> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('report_conversations')
      .select('*')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .single();

    return data;
  }

  /**
   * Create share link
   */
  async createShareLink(
    reportId: string,
    userId: string,
    accessLevel: 'view' | 'download',
    expiresInDays?: number,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const shareToken = randomBytes(32).toString('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await client
      .from('reports')
      .update({
        share_token: shareToken,
        share_access_level: accessLevel,
        share_expires_at: expiresAt,
      })
      .eq('id', reportId)
      .eq('user_id', userId);

    if (error) throw error;
    return shareToken;
  }

  /**
   * Get shared report by token
   */
  async getSharedReport(token: string): Promise<any> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('reports')
      .select(
        `
        *,
        template:report_templates(slug, name, icon, config)
      `,
      )
      .eq('share_token', token)
      .or('share_expires_at.is.null,share_expires_at.gt.now()')
      .single();

    if (error || !data) return null;

    // Increment view count
    await client
      .from('reports')
      .update({ share_view_count: (data.share_view_count || 0) + 1 })
      .eq('id', data.id);

    return data;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(
    templateName: string,
    geographyName: string,
  ): string {
    // Shorten geography name if too long
    const shortGeoName =
      geographyName.length > 30 ? geographyName.split(',')[0] : geographyName;
    return `${shortGeoName} - ${templateName}`;
  }

  /**
   * Fetch market metrics for a geography to populate AI context
   * @param geographyId - The geography ID (CBSA code, FIPS, or ZIP)
   * @param geographyType - Type of geography
   * @param requiredMetrics - Optional list of specific metrics to fetch (from template.config.data_requirements.current_metrics)
   *                          If empty/undefined, fetches all available metrics
   */
  private async fetchMarketMetrics(
    geographyId: string,
    geographyType: 'metro' | 'county' | 'zip',
    requiredMetrics?: string[],
  ): Promise<MarketMetrics> {
    const client = this.supabase.getClient();
    const metrics: MarketMetrics = {};

    // Helper to check if a metric should be fetched
    const shouldFetch = (metricName: string): boolean => {
      // If no specific requirements, fetch everything
      if (!requiredMetrics || requiredMetrics.length === 0) return true;
      // Check if this metric or its category is required
      return requiredMetrics.some(req =>
        metricName.includes(req) || req.includes(metricName) || req === '*'
      );
    };

    try {
      // Fetch based on geography type
      if (geographyType === 'metro') {
        // Get Realtor metro data (median price, days on market, inventory)
        if (shouldFetch('realtor') || shouldFetch('median_listing_price') || shouldFetch('days_on_market') || shouldFetch('inventory') || shouldFetch('hotness')) {
          const { data: realtorData } = await client
            .from('realtor_metro')
            .select('*')
            .eq('cbsa_code', geographyId)
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          if (realtorData) {
            metrics.median_listing_price = realtorData.median_listing_price;
            metrics.median_listing_price_yoy = realtorData.median_listing_price_yy;
            metrics.days_on_market = realtorData.median_days_on_market;
            metrics.active_listing_count = realtorData.active_listing_count;
            metrics.inventory_yoy = realtorData.active_listing_count_yy;
            metrics.pending_ratio = realtorData.pending_ratio;
            metrics.price_reduced_share = realtorData.price_reduced_share;
            metrics.hotness_score = realtorData.hotness_score;
            metrics.demand_score = realtorData.demand_score;
          }
        }

        // Get Zillow ZHVI data (use cbsa_code, not region_id)
        if (shouldFetch('zhvi') || shouldFetch('home_value')) {
          const { data: zhviData } = await client
            .from('zillow_metro')
            .select('value')
            .eq('cbsa_code', geographyId)
            .eq('metric_name', 'zhvi')
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          if (zhviData) {
            metrics.zhvi = zhviData.value;
          }
        }

        // Get YoY ZHVI change (compare current to 12 months ago)
        if (shouldFetch('zhvi_yoy') || shouldFetch('home_value')) {
          const { data: zhviHistory } = await client
            .from('zillow_metro')
            .select('value, period_date')
            .eq('cbsa_code', geographyId)
            .eq('metric_name', 'zhvi')
            .order('period_date', { ascending: false })
            .limit(13);

          if (zhviHistory && zhviHistory.length >= 12) {
            const current = zhviHistory[0]?.value;
            const yearAgo = zhviHistory[12]?.value;
            if (current && yearAgo) {
              metrics.zhvi_yoy = ((current - yearAgo) / yearAgo) * 100;
            }
          }
        }

        // Get ZORI (rent) data from zillow_metro table
        if (shouldFetch('zori') || shouldFetch('rent')) {
          const { data: zoriData } = await client
            .from('zillow_metro')
            .select('value')
            .eq('cbsa_code', geographyId)
            .eq('metric_name', 'zori')
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          if (zoriData) {
            metrics.zori = zoriData.value;
          }
        }

        // Get calculated metrics (cap rate, GRM, etc.)
        if (shouldFetch('cap_rate') || shouldFetch('gross_yield') || shouldFetch('grm') || shouldFetch('investment')) {
          const { data: calcMetrics } = await client
            .from('calculated_metrics')
            .select('*')
            .eq('geography_id', geographyId)
            .eq('geography_type', 'metro')
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          if (calcMetrics) {
            metrics.cap_rate = calcMetrics.cap_rate;
            metrics.gross_yield = calcMetrics.gross_yield;
            metrics.grm = calcMetrics.grm;
            metrics.overvalued_pct = calcMetrics.overvalued_pct;
            // Use rent_price_ratio instead of affordability_ratio
            metrics.rent_to_price_ratio = calcMetrics.rent_price_ratio;
            metrics.affordability_index = calcMetrics.affordability_percentile;
            metrics.gross_rent_multiplier = calcMetrics.grm;
          }
        }

        // Get Census data from census_metro table
        if (shouldFetch('census') || shouldFetch('median_income') || shouldFetch('population') || shouldFetch('demographics')) {
          const { data: censusData } = await client
            .from('census_metro')
            .select('total_population, median_household_income, median_age, population_yoy')
            .eq('cbsa_code', geographyId)
            .order('year', { ascending: false })
            .limit(1)
            .single();

          if (censusData) {
            metrics.median_income = censusData.median_household_income;
            metrics.median_household_income = censusData.median_household_income;
            metrics.population = censusData.total_population;
            metrics.median_age = censusData.median_age;
            metrics.population_growth_yoy = censusData.population_yoy;
          }
        }
      } else if (geographyType === 'county') {
        // Get Realtor county data
        const { data: realtorData } = await client
          .from('realtor_county')
          .select('*')
          .eq('county_fips', geographyId)
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (realtorData) {
          metrics.median_listing_price = realtorData.median_listing_price;
          metrics.median_listing_price_yoy = realtorData.median_listing_price_yy;
          metrics.days_on_market = realtorData.median_days_on_market;
          metrics.active_listing_count = realtorData.active_listing_count;
          metrics.inventory_yoy = realtorData.active_listing_count_yy;
        }

        // Get calculated metrics
        const { data: calcMetrics } = await client
          .from('calculated_metrics')
          .select('*')
          .eq('geography_id', geographyId)
          .eq('geography_type', 'county')
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (calcMetrics) {
          metrics.cap_rate = calcMetrics.cap_rate;
          metrics.gross_yield = calcMetrics.gross_yield;
          metrics.affordability_ratio = calcMetrics.affordability_ratio;
        }
      } else if (geographyType === 'zip') {
        // Get Realtor zip data
        const { data: realtorData } = await client
          .from('realtor_zip')
          .select('*')
          .eq('postal_code', geographyId)
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (realtorData) {
          metrics.median_listing_price = realtorData.median_listing_price;
          metrics.median_listing_price_yoy = realtorData.median_listing_price_yy;
          metrics.days_on_market = realtorData.median_days_on_market;
          metrics.active_listing_count = realtorData.active_listing_count;
        }

        // Get calculated metrics
        const { data: calcMetrics } = await client
          .from('calculated_metrics')
          .select('*')
          .eq('geography_id', geographyId)
          .eq('geography_type', 'zip')
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (calcMetrics) {
          metrics.cap_rate = calcMetrics.cap_rate;
          metrics.gross_yield = calcMetrics.gross_yield;
        }
      }

      // Create aliases for template variable names
      // Templates use different names than database columns
      metrics.market_heat_index = metrics.hotness_score;
      metrics.for_sale_inventory = metrics.active_listing_count;
      metrics.days_to_pending = metrics.days_on_market;
      metrics.median_household_income = metrics.median_income;
      metrics.population_growth_yoy = metrics.population_yoy;
      metrics.cap_rate_proxy = metrics.cap_rate;
      metrics.gross_rent_multiplier = metrics.grm;
      metrics.price_cut_pct = metrics.price_reduced_share;

      this.logger.log(`Fetched market metrics for ${geographyType} ${geographyId}: ${Object.keys(metrics).filter(k => metrics[k as keyof MarketMetrics] !== undefined).length} fields`);
    } catch (error) {
      this.logger.error(`Failed to fetch market metrics for ${geographyId}:`, error);
    }

    return metrics;
  }

  /**
   * Fetch historical data for key metrics (last 6 months)
   *
   * Metrics with timeseries support:
   * - zhvi (home_value): Zillow Home Value Index
   * - zori (rent_index): Zillow Observed Rent Index
   * - days_on_market: Median days on market from Realtor
   * - active_listing_count (for_sale_inventory): Active listings from Realtor
   * - hotness_score: Market hotness from Realtor
   * - cap_rate: Calculated cap rate (computed from ZHVI + ZORI)
   *
   * @param geographyId - The geography ID (CBSA code, FIPS, or ZIP)
   * @param geographyType - Type of geography
   * @returns Historical data for each metric with trend and change percentage
   */
  private async fetchHistoricalData(
    geographyId: string,
    geographyType: 'metro' | 'county' | 'zip',
  ): Promise<HistoricalData> {
    const historical: HistoricalData = {};

    // Key metrics that have timeseries data
    // Map report metric names to timeseries metricIds
    const metricsToFetch: Array<{ reportKey: string; timeseriesId: string }> = [
      { reportKey: 'zhvi', timeseriesId: 'home_value' },
      { reportKey: 'zori', timeseriesId: 'rent_index' },
      { reportKey: 'days_on_market', timeseriesId: 'days_on_market' },
      { reportKey: 'active_listing_count', timeseriesId: 'for_sale_inventory' },
      { reportKey: 'hotness_score', timeseriesId: 'hotness_score' },
      { reportKey: 'cap_rate', timeseriesId: 'cap_rate' },
    ];

    // Fetch all metrics in parallel for performance
    const fetchPromises = metricsToFetch.map(async ({ reportKey, timeseriesId }) => {
      try {
        // Use lastPoints to get the most recent N months of data
        // HISTORY_MONTHS_MAX = 6, so we fetch 6 data points
        const data = await this.timeSeriesService.getTimeSeries(
          timeseriesId,
          geographyType,
          geographyId,
          undefined, // startDate
          undefined, // endDate
          undefined, // limit
          HISTORY_MONTHS_MAX, // lastPoints - get last 6 months
        );

        if (!data || data.length === 0) {
          this.logger.debug(`No historical data for ${reportKey} in ${geographyType} ${geographyId}`);
          return { reportKey, result: null };
        }

        // Calculate trend and change percentage
        const { trend, change_pct } = this.calculateTrendAndChange(data);

        return {
          reportKey,
          result: {
            data: data.map(d => ({ date: d.date, value: d.value })),
            trend,
            change_pct,
          } as HistoricalMetricData,
        };
      } catch (error) {
        this.logger.warn(`Failed to fetch historical data for ${reportKey}: ${error.message}`);
        return { reportKey, result: null };
      }
    });

    // Wait for all fetches to complete
    const results = await Promise.all(fetchPromises);

    // Build the historical data object
    for (const { reportKey, result } of results) {
      if (result) {
        historical[reportKey] = result;
      }
    }

    this.logger.log(
      `Fetched historical data for ${geographyType} ${geographyId}: ${Object.keys(historical).length} metrics`,
    );

    return historical;
  }

  /**
   * Calculate trend direction and percentage change from timeseries data
   *
   * @param data - Array of timeseries data points (ordered chronologically, oldest first)
   * @returns Object with trend ('up', 'down', 'stable') and change_pct
   */
  private calculateTrendAndChange(data: TimeSeriesDataPoint[]): {
    trend: 'up' | 'down' | 'stable';
    change_pct: number;
  } {
    if (data.length < 2) {
      return { trend: 'stable', change_pct: 0 };
    }

    // First value is oldest, last value is most recent
    const oldestValue = data[0].value;
    const latestValue = data[data.length - 1].value;

    // Calculate percentage change
    let change_pct = 0;
    if (oldestValue !== 0) {
      change_pct = ((latestValue - oldestValue) / Math.abs(oldestValue)) * 100;
    }

    // Round to 2 decimal places
    change_pct = Math.round(change_pct * 100) / 100;

    // Determine trend with a threshold for "stable" (within +/- 1%)
    let trend: 'up' | 'down' | 'stable';
    if (change_pct > 1) {
      trend = 'up';
    } else if (change_pct < -1) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    return { trend, change_pct };
  }

  /**
   * Format number for display
   */
  private formatNumber(value: number | undefined, decimals = 0): string {
    if (value === undefined || value === null) return 'N/A';
    if (decimals === 0) return Math.round(value).toLocaleString();
    return value.toFixed(decimals);
  }

  /**
   * Format currency for display
   */
  private formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A';
    return '$' + Math.round(value).toLocaleString();
  }

  /**
   * Format percentage for display
   */
  private formatPercent(value: number | undefined, decimals = 1): string {
    if (value === undefined || value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  /**
   * Format priority name for display
   */
  private formatPriorityName(priority: string): string {
    const names: Record<string, string> = {
      affordability: 'Affordability',
      appreciation: 'Appreciation',
      job_market: 'Job Market',
      market_timing: 'Market Timing',
      lifestyle: 'Lifestyle',
      cash_flow: 'Cash Flow',
      tenant_demand: 'Tenant Demand',
      entry_price: 'Entry Price',
      stability: 'Stability',
    };
    return names[priority] || priority;
  }

  // ============================================================================
  // Score Contextualization
  // ============================================================================

  /**
   * Generate human-readable context for a score
   *
   * @param score - The numeric score (0-100)
   * @param scoreType - The type of score (homeready, investoredge, markethealth)
   * @param geoData - Optional geography data for enhanced context
   * @returns ScoreContext with interpretation and comparison text
   */
  generateScoreContext(
    score: number,
    scoreType: ScoreType,
    geoData?: {
      geography_type?: 'metro' | 'county' | 'zip';
      median_price?: number;
      percentile?: number;
      total_markets?: number;
    },
  ): ScoreContext {
    // Get base interpretation based on score range
    const interpretation = this.getScoreInterpretation(score, scoreType);

    // Generate percentile text
    const percentile_text = this.getPercentileText(score, scoreType, geoData);

    // Generate dollar impact based on score type and value
    const dollar_impact = this.getDollarImpact(score, scoreType, geoData?.median_price);

    // Generate comparison text
    const comparison = this.getComparisonText(score, geoData);

    return {
      interpretation,
      percentile_text,
      dollar_impact,
      comparison,
    };
  }

  /**
   * Get human-readable interpretation based on score range
   */
  private getScoreInterpretation(score: number, scoreType: ScoreType): string {
    // Score range labels based on GRADE_THRESHOLDS
    const getRangeLabel = (score: number): string => {
      if (score >= 93) return 'exceptional';
      if (score >= 87) return 'excellent';
      if (score >= 80) return 'very good';
      if (score >= 73) return 'good';
      if (score >= 67) return 'above average';
      if (score >= 60) return 'moderate';
      if (score >= 50) return 'below average';
      if (score >= 40) return 'poor';
      return 'very poor';
    };

    const rangeLabel = getRangeLabel(score);

    // Score-type specific interpretations
    const interpretations: Record<ScoreType, Record<string, string>> = {
      homeready: {
        exceptional: 'Exceptional buying conditions with strong appreciation potential',
        excellent: 'Excellent market for homebuyers with favorable long-term outlook',
        'very good': 'Very good buying opportunity with solid fundamentals',
        good: 'Good conditions for buyers seeking stable markets',
        'above average': 'Above average market with reasonable buying conditions',
        moderate: 'Moderate conditions - consider timing and specific neighborhoods',
        'below average': 'Below average conditions - buyer caution advised',
        poor: 'Poor buying conditions - significant headwinds present',
        'very poor': 'Very challenging market for homebuyers',
      },
      investoredge: {
        exceptional: 'Exceptional investment opportunity with strong returns expected',
        excellent: 'Excellent rental market with high yield potential',
        'very good': 'Very good investment fundamentals and cash flow potential',
        good: 'Good investment conditions with reasonable returns',
        'above average': 'Above average returns likely compared to most markets',
        moderate: 'Moderate investment potential - selective opportunities exist',
        'below average': 'Below average returns expected - careful analysis needed',
        poor: 'Poor investment conditions - limited upside potential',
        'very poor': 'Very challenging for real estate investment',
      },
      markethealth: {
        exceptional: 'Exceptionally strong market with high demand and activity',
        excellent: 'Excellent market health with robust buyer competition',
        'very good': 'Very healthy market conditions with strong momentum',
        good: 'Good market dynamics with balanced supply and demand',
        'above average': 'Above average market activity and conditions',
        moderate: 'Moderate market conditions - neither hot nor cold',
        'below average': 'Below average market activity - slower conditions',
        poor: 'Poor market health - low demand and slow activity',
        'very poor': 'Very weak market conditions with significant oversupply',
      },
    };

    return interpretations[scoreType][rangeLabel] || 'Score data available';
  }

  /**
   * Generate percentile comparison text
   */
  private getPercentileText(
    score: number,
    scoreType: ScoreType,
    geoData?: { geography_type?: 'metro' | 'county' | 'zip'; percentile?: number; total_markets?: number },
  ): string {
    // If we have actual percentile data, use it
    if (geoData?.percentile !== undefined) {
      const position = geoData.percentile;
      if (position <= 10) return `Top 10% of ${this.getGeoLabel(geoData.geography_type)}s`;
      if (position <= 25) return `Top 25% of ${this.getGeoLabel(geoData.geography_type)}s`;
      if (position <= 50) return `Top half of ${this.getGeoLabel(geoData.geography_type)}s`;
      if (position <= 75) return `Bottom half of ${this.getGeoLabel(geoData.geography_type)}s`;
      return `Bottom 25% of ${this.getGeoLabel(geoData.geography_type)}s`;
    }

    // Scores are normalized 0-100 across all markets, so score roughly maps to percentile
    const geoLabel = this.getGeoLabel(geoData?.geography_type);

    if (score >= 90) {
      return `Top 10% of ${geoLabel}s nationwide`;
    } else if (score >= 80) {
      return `Top 20% of ${geoLabel}s nationwide`;
    } else if (score >= 70) {
      return `Top 30% of ${geoLabel}s nationwide`;
    } else if (score >= 60) {
      return `Above average among ${geoLabel}s`;
    } else if (score >= 50) {
      return `Average compared to other ${geoLabel}s`;
    } else if (score >= 40) {
      return `Below average among ${geoLabel}s`;
    } else {
      return `Bottom 40% of ${geoLabel}s nationwide`;
    }
  }

  /**
   * Get geography label for display
   */
  private getGeoLabel(geoType?: 'metro' | 'county' | 'zip'): string {
    switch (geoType) {
      case 'metro': return 'metro area';
      case 'county': return 'county';
      case 'zip': return 'ZIP code';
      default: return 'market';
    }
  }

  /**
   * Generate practical dollar impact text based on score type
   */
  private getDollarImpact(
    score: number,
    scoreType: ScoreType,
    medianPrice?: number,
  ): string | undefined {
    // Don't generate dollar impact if no price data
    if (!medianPrice) return undefined;

    // Calculate appreciation/return estimates based on score
    // These are rough estimates based on historical data patterns
    switch (scoreType) {
      case 'homeready': {
        // HomeReady predicts 3-year appreciation
        // High scores (80+) historically correlate with ~5-8% annual appreciation
        // Low scores (40-) correlate with 0-2% annual appreciation
        let annualAppreciation: number;
        if (score >= 80) {
          annualAppreciation = 5 + ((score - 80) / 20) * 3; // 5-8%
        } else if (score >= 60) {
          annualAppreciation = 3 + ((score - 60) / 20) * 2; // 3-5%
        } else if (score >= 40) {
          annualAppreciation = 1 + ((score - 40) / 20) * 2; // 1-3%
        } else {
          annualAppreciation = Math.max(0, (score / 40) * 1); // 0-1%
        }

        const threeYearGain = medianPrice * (Math.pow(1 + annualAppreciation / 100, 3) - 1);

        if (threeYearGain > 1000) {
          return `Homes in similar markets have historically appreciated ~${this.formatCurrency(Math.round(threeYearGain))} over 3 years (${annualAppreciation.toFixed(1)}% annually)`;
        }
        return `Limited appreciation expected (~${annualAppreciation.toFixed(1)}% annually) based on current market conditions`;
      }

      case 'investoredge': {
        // InvestorEdge predicts total return (appreciation + yield)
        // High scores suggest ~8-12% total annual return
        // Low scores suggest 2-5% total annual return
        let totalReturn: number;
        if (score >= 80) {
          totalReturn = 8 + ((score - 80) / 20) * 4; // 8-12%
        } else if (score >= 60) {
          totalReturn = 5 + ((score - 60) / 20) * 3; // 5-8%
        } else if (score >= 40) {
          totalReturn = 3 + ((score - 40) / 20) * 2; // 3-5%
        } else {
          totalReturn = 2 + (score / 40) * 1; // 2-3%
        }

        const annualReturn = medianPrice * (totalReturn / 100);

        if (annualReturn > 5000) {
          return `Expected annual return potential of ~${this.formatCurrency(annualReturn)} (${totalReturn.toFixed(1)}% yield + appreciation)`;
        }
        return undefined;
      }

      case 'markethealth': {
        // MarketHealth is about current conditions, not returns
        // Focus on liquidity and time-to-sell implications
        if (score >= 80) {
          return 'Properties typically sell within 2-3 weeks at or above asking price';
        } else if (score >= 60) {
          return 'Properties typically sell within 30-45 days near asking price';
        } else if (score >= 40) {
          return 'Properties may take 60-90 days to sell, often with price negotiations';
        } else {
          return 'Extended time on market common; significant negotiation expected';
        }
      }

      default:
        return undefined;
    }
  }

  /**
   * Generate comparison text based on score and geography
   */
  private getComparisonText(
    score: number,
    geoData?: { geography_type?: 'metro' | 'county' | 'zip'; total_markets?: number },
  ): string | undefined {
    // Calculate approximate percentile from score
    // Scores are normalized 0-100, so a score of 75 means roughly better than 75% of markets
    const betterThanPercent = Math.round(score);

    if (score >= 80) {
      return `Better than ${betterThanPercent}% of comparable areas`;
    } else if (score >= 60) {
      return `Outperforming ${betterThanPercent}% of similar markets`;
    } else if (score >= 40) {
      return `Performing similar to average markets`;
    } else {
      return `Underperforming compared to ${100 - betterThanPercent}% of markets`;
    }
  }

  /**
   * Generate score contexts for all score types in a report
   * Returns a map of score type to context
   */
  generateAllScoreContexts(
    scores: {
      homeready?: { score: number; grade: string };
      investoredge?: { score: number; grade: string };
      markethealth?: { score: number; grade: string };
    },
    geoData?: {
      geography_type?: 'metro' | 'county' | 'zip';
      median_price?: number;
    },
  ): Record<ScoreType, ScoreContext | null> {
    const contexts: Record<ScoreType, ScoreContext | null> = {
      homeready: null,
      investoredge: null,
      markethealth: null,
    };

    if (scores.homeready) {
      contexts.homeready = this.generateScoreContext(
        scores.homeready.score,
        'homeready',
        geoData,
      );
    }

    if (scores.investoredge) {
      contexts.investoredge = this.generateScoreContext(
        scores.investoredge.score,
        'investoredge',
        geoData,
      );
    }

    if (scores.markethealth) {
      contexts.markethealth = this.generateScoreContext(
        scores.markethealth.score,
        'markethealth',
        geoData,
      );
    }

    return contexts;
  }

  // ============================================================================
  // Priority-Weighted Winner Logic
  // ============================================================================

  /**
   * Priority to metric mappings for each user type
   */
  private readonly PRIORITY_METRICS: Record<string, string[]> = {
    // Homebuyer priorities
    affordability: ['affordability_index', 'median_income', 'median_listing_price'],
    appreciation: ['zhvi_yoy', 'zhvf_1yr_pct', 'zhvi_5y_cagr'],
    job_market: ['job_growth_yoy', 'unemployment_rate'],
    market_timing: ['days_on_market', 'months_of_supply', 'price_cut_pct'],
    lifestyle: ['population', 'median_age', 'population_growth_yoy'],

    // Investor priorities
    cash_flow: ['cap_rate', 'gross_yield', 'rent_to_price_ratio'],
    tenant_demand: ['zori_yoy', 'zordi', 'demand_score'],
    entry_price: ['median_listing_price', 'overvalued_pct'],
    stability: ['months_of_supply', 'inventory_yoy', 'zhvi_yoy'],
  };

  /**
   * Metrics where lower values are better
   */
  private readonly LOWER_IS_BETTER: Set<string> = new Set([
    'unemployment_rate',
    'days_on_market',
    'months_of_supply',
    'price_cut_pct',
    'median_listing_price',
    'overvalued_pct',
  ]);

  /**
   * Calculate the priority-weighted winner between markets
   *
   * @param primaryMarket - Primary market data with geography and metrics
   * @param comparisonMarkets - Comparison market data
   * @param priorities - User's priorities (up to 3)
   * @param userType - homebuyer or investor
   * @returns Winner information with reasons
   */
  calculatePriorityWeightedWinner(
    primaryMarket: {
      geography: { id: string; name: string };
      metrics: MarketMetrics;
      scores?: any;
    },
    comparisonMarkets: Array<{
      geography: { id: string; name: string };
      metrics: MarketMetrics;
      scores?: any;
    }>,
    priorities: string[],
    userType: 'homebuyer' | 'investor',
  ): PriorityWeightedResult | null {
    if (!priorities || priorities.length === 0 || comparisonMarkets.length === 0) {
      return null;
    }

    // Combine all markets for comparison
    const allMarkets = [
      primaryMarket,
      ...comparisonMarkets,
    ];

    // Weight by position: 1st priority = 3pts, 2nd = 2pts, 3rd = 1pt
    const weights = [3, 2, 1];

    // Track scores for each market
    const marketScores: Map<string, number> = new Map();
    const priorityResults: Array<{
      priority: string;
      weight: number;
      winnerId: string;
      winnerName: string;
      keyMetric: string;
      winnerValue: number | null;
      loserValue: number | null;
      reason: string;
    }> = [];

    // Initialize scores
    for (const market of allMarkets) {
      marketScores.set(market.geography.id, 0);
    }

    // Score each priority
    for (let i = 0; i < Math.min(priorities.length, 3); i++) {
      const priority = priorities[i];
      const weight = weights[i];
      const metricsForPriority = this.PRIORITY_METRICS[priority] || [];

      if (metricsForPriority.length === 0) {
        continue;
      }

      // Find the best market for this priority
      let bestMarket = allMarkets[0];
      let bestScore = -Infinity;
      let keyMetric = metricsForPriority[0];
      let bestValue: number | null = null;

      for (const market of allMarkets) {
        let priorityScore = 0;
        let validMetrics = 0;

        for (const metric of metricsForPriority) {
          const value = market.metrics[metric as keyof MarketMetrics];
          if (value != null && typeof value === 'number') {
            // Normalize: lower is better metrics get inverted
            const normalizedValue = this.LOWER_IS_BETTER.has(metric) ? -value : value;
            priorityScore += normalizedValue;
            validMetrics++;
          }
        }

        // Average the score if we have valid metrics
        const avgScore = validMetrics > 0 ? priorityScore / validMetrics : 0;

        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestMarket = market;
          // Find the primary metric value for display
          for (const m of metricsForPriority) {
            const v = market.metrics[m as keyof MarketMetrics];
            if (v != null) {
              keyMetric = m;
              bestValue = v as number;
              break;
            }
          }
        }
      }

      // Award points to the best market
      const currentScore = marketScores.get(bestMarket.geography.id) || 0;
      marketScores.set(bestMarket.geography.id, currentScore + weight);

      // Find the "loser" value for comparison
      let loserValue: number | null = null;
      for (const market of allMarkets) {
        if (market.geography.id !== bestMarket.geography.id) {
          const v = market.metrics[keyMetric as keyof MarketMetrics];
          if (v != null) {
            loserValue = v as number;
            break;
          }
        }
      }

      // Generate reason text
      const reason = this.generatePriorityReason(
        priority,
        keyMetric,
        bestValue,
        loserValue,
        bestMarket.geography.name,
      );

      priorityResults.push({
        priority,
        weight,
        winnerId: bestMarket.geography.id,
        winnerName: bestMarket.geography.name,
        keyMetric,
        winnerValue: bestValue,
        loserValue,
        reason,
      });
    }

    // Find overall winner
    let winnerId = allMarkets[0].geography.id;
    let winnerName = allMarkets[0].geography.name;
    let maxScore = 0;

    for (const [marketId, score] of marketScores) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = marketId;
        const market = allMarkets.find(m => m.geography.id === marketId);
        winnerName = market?.geography.name || marketId;
      }
    }

    // Generate top 3 reasons
    const reasons = priorityResults
      .filter(r => r.winnerId === winnerId)
      .slice(0, 3)
      .map(r => r.reason);

    return {
      winnerId,
      winnerName,
      totalScore: maxScore,
      priorityScores: priorityResults,
      reasons,
    };
  }

  /**
   * Generate a human-readable reason for why a market won on a priority
   */
  private generatePriorityReason(
    priority: string,
    metric: string,
    winnerValue: number | null,
    loserValue: number | null,
    winnerName: string,
  ): string {
    const priorityLabels: Record<string, string> = {
      affordability: 'Affordability',
      appreciation: 'Appreciation Potential',
      job_market: 'Job Market Strength',
      market_timing: 'Market Timing',
      lifestyle: 'Lifestyle Factors',
      cash_flow: 'Cash Flow',
      tenant_demand: 'Tenant Demand',
      entry_price: 'Entry Price',
      stability: 'Market Stability',
    };

    const metricDescriptions: Record<string, string> = {
      affordability_index: 'better affordability ratio',
      median_income: 'higher household incomes',
      median_listing_price: 'lower median prices',
      zhvi_yoy: 'stronger year-over-year appreciation',
      zhvf_1yr_pct: 'better appreciation forecast',
      zhvi_5y_cagr: 'stronger 5-year appreciation history',
      job_growth_yoy: 'stronger job growth',
      unemployment_rate: 'lower unemployment',
      days_on_market: 'faster-selling market',
      months_of_supply: 'tighter inventory',
      price_cut_pct: 'fewer price cuts',
      cap_rate: 'higher cap rate',
      gross_yield: 'better gross yield',
      rent_to_price_ratio: 'better rent-to-price ratio',
      zori_yoy: 'stronger rent growth',
      zordi: 'higher rental demand',
      demand_score: 'stronger buyer demand',
      overvalued_pct: 'less overvalued relative to fundamentals',
      inventory_yoy: 'healthier inventory levels',
      population: 'larger population base',
      median_age: 'favorable demographics',
      population_growth_yoy: 'stronger population growth',
    };

    const priorityLabel = priorityLabels[priority] || priority;
    const metricDesc = metricDescriptions[metric] || metric;

    if (winnerValue == null) {
      return `${winnerName} wins on ${priorityLabel}`;
    }

    // Format the value based on the metric type
    let formattedWinner = String(winnerValue);
    let formattedLoser = loserValue != null ? String(loserValue) : 'N/A';

    if (metric.includes('rate') || metric.includes('pct') || metric.includes('yoy') || metric.includes('cagr')) {
      formattedWinner = `${winnerValue.toFixed(1)}%`;
      formattedLoser = loserValue != null ? `${loserValue.toFixed(1)}%` : 'N/A';
    } else if (metric.includes('price') || metric.includes('income')) {
      formattedWinner = this.formatCurrency(winnerValue);
      formattedLoser = loserValue != null ? this.formatCurrency(loserValue) : 'N/A';
    } else if (metric === 'days_on_market' || metric === 'months_of_supply') {
      formattedWinner = `${Math.round(winnerValue)} days`;
      formattedLoser = loserValue != null ? `${Math.round(loserValue)} days` : 'N/A';
    }

    return `${winnerName} leads on ${priorityLabel} with ${metricDesc} (${formattedWinner} vs ${formattedLoser})`;
  }
}
