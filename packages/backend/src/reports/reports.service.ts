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
import { GenerateReportDto } from './dto/generate-report.dto';
import { randomBytes } from 'crypto';

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
        user_inputs: dto.user_inputs || {},
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
    this.generateReportAsync(report.id, template, dto, startTime);

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
        historical: {},
        benchmarks: {},
        scores: {
          homeready: scores
            ? {
                score: scores.scores.homeready.score,
                grade: scores.scores.homeready.grade,
                trend: 'stable',
              }
            : undefined,
          investoredge: scores
            ? {
                score: scores.scores.investoredge.score,
                grade: scores.scores.investoredge.grade,
                trend: 'stable',
              }
            : undefined,
          markethealth: scores
            ? {
                score: scores.scores.markethealth.score,
                grade: scores.scores.markethealth.grade,
                trend: 'stable',
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
      };

      // 4. Generate AI narratives (Claude) with news context
      let aiNarratives = {};
      if (template.config.ai_config?.narrative_sections) {
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
            // Basic info
            geography_name: dto.primary_geography.name,
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

    // Generate AI response
    const response = await this.claudeService.generateConversationResponse(
      content,
      conversation.messages || [],
      report,
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
}
