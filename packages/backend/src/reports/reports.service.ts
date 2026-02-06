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

/** Market metrics for AI context */
export interface MarketMetrics {
  // Price metrics
  zhvi?: number;
  zhvi_yoy?: number;
  median_listing_price?: number;
  median_listing_price_yoy?: number;
  // Rent metrics
  zori?: number;
  zori_yoy?: number;
  // Market activity
  hotness_score?: number;
  demand_score?: number;
  days_on_market?: number;
  days_pending?: number;
  active_listing_count?: number;
  inventory_yoy?: number;
  pending_ratio?: number;
  price_reduced_share?: number;
  // Calculated metrics
  cap_rate?: number;
  gross_yield?: number;
  grm?: number;
  overvalued_pct?: number;
  affordability_ratio?: number;
  // Census data
  median_income?: number;
  population?: number;
  population_yoy?: number;
  unemployment_rate?: number;
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

      // 1b. Fetch market metrics for AI context
      const marketMetrics = await this.fetchMarketMetrics(
        dto.primary_geography.id,
        geoType,
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

            // Scores (formatted for display)
            homeready_score: scores ? Math.round(scores.scores.homeready.score) : 'N/A',
            investoredge_score: scores ? Math.round(scores.scores.investoredge.score) : 'N/A',
            markethealth_score: scores ? Math.round(scores.scores.markethealth.score) : 'N/A',
            homeready_grade: scores?.scores.homeready.grade || 'N/A',
            investoredge_grade: scores?.scores.investoredge.grade || 'N/A',

            // Price metrics
            zhvi: this.formatCurrency(marketMetrics.zhvi),
            zhvi_yoy: this.formatPercent(marketMetrics.zhvi_yoy),
            median_listing_price: this.formatCurrency(marketMetrics.median_listing_price),
            median_price_yoy: this.formatPercent(marketMetrics.median_listing_price_yoy),

            // Rent metrics
            zori: this.formatCurrency(marketMetrics.zori),
            median_rent: this.formatCurrency(marketMetrics.zori),

            // Market activity
            market_heat_index: this.formatNumber(marketMetrics.hotness_score),
            hotness_score: this.formatNumber(marketMetrics.hotness_score),
            demand_score: this.formatNumber(marketMetrics.demand_score),
            days_on_market: this.formatNumber(marketMetrics.days_on_market),
            days_pending: this.formatNumber(marketMetrics.days_on_market), // Alias
            active_listings: this.formatNumber(marketMetrics.active_listing_count),
            inventory_yoy: this.formatPercent(marketMetrics.inventory_yoy),
            pending_ratio: marketMetrics.pending_ratio ? `${(marketMetrics.pending_ratio * 100).toFixed(1)}%` : 'N/A',
            price_reduced_share: marketMetrics.price_reduced_share ? `${(marketMetrics.price_reduced_share * 100).toFixed(1)}%` : 'N/A',

            // Investment metrics
            cap_rate: marketMetrics.cap_rate ? `${marketMetrics.cap_rate.toFixed(2)}%` : 'N/A',
            gross_yield: marketMetrics.gross_yield ? `${marketMetrics.gross_yield.toFixed(2)}%` : 'N/A',
            grm: marketMetrics.grm ? marketMetrics.grm.toFixed(1) : 'N/A',
            overvalued_pct: this.formatPercent(marketMetrics.overvalued_pct),

            // Economic data
            median_income: this.formatCurrency(marketMetrics.median_income),
            population: marketMetrics.population ? marketMetrics.population.toLocaleString() : 'N/A',
            affordability_ratio: marketMetrics.affordability_ratio ? marketMetrics.affordability_ratio.toFixed(1) : 'N/A',

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
   */
  private async fetchMarketMetrics(
    geographyId: string,
    geographyType: 'metro' | 'county' | 'zip',
  ): Promise<MarketMetrics> {
    const client = this.supabase.getClient();
    const metrics: MarketMetrics = {};

    try {
      // Fetch based on geography type
      if (geographyType === 'metro') {
        // Get Realtor metro data (median price, days on market, inventory)
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

        // Get Zillow ZHVI data
        const { data: zhviData } = await client
          .from('zillow_metro')
          .select('value')
          .eq('region_id', geographyId)
          .eq('metric_name', 'zhvi')
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (zhviData) {
          metrics.zhvi = zhviData.value;
        }

        // Get YoY ZHVI change (compare current to 12 months ago)
        const { data: zhviHistory } = await client
          .from('zillow_metro')
          .select('value, period_date')
          .eq('region_id', geographyId)
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

        // Get ZORI (rent) data
        const { data: zoriData } = await client
          .from('zillow_zori')
          .select('value')
          .eq('region_id', geographyId)
          .eq('geography', 'Metro')
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (zoriData) {
          metrics.zori = zoriData.value;
        }

        // Get calculated metrics (cap rate, GRM, etc.)
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
          metrics.affordability_ratio = calcMetrics.affordability_ratio;
        }

        // Get Census data
        const { data: incomeData } = await client
          .from('census_data')
          .select('value')
          .eq('geography_id', geographyId)
          .eq('geography_type', 'metro')
          .eq('metric_name', 'median_income')
          .order('year', { ascending: false })
          .limit(1)
          .single();

        if (incomeData) {
          metrics.median_income = incomeData.value;
        }

        const { data: popData } = await client
          .from('census_data')
          .select('value')
          .eq('geography_id', geographyId)
          .eq('geography_type', 'metro')
          .eq('metric_name', 'population')
          .order('year', { ascending: false })
          .limit(1)
          .single();

        if (popData) {
          metrics.population = popData.value;
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

      this.logger.log(`Fetched market metrics for ${geographyType} ${geographyId}: ${Object.keys(metrics).length} fields`);
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
