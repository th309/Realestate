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

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
    private readonly geminiNewsService: GeminiNewsService,
  ) { }

  /**
   * Get available report templates
   */
  async getTemplates(tier?: string): Promise<ReportTemplate[]> {
    const client = this.supabase.getClient();
    let query = client
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
  async generateReport(userId: string, dto: GenerateReportDto): Promise<string> {
    const client = this.supabase.getClient();
    const startTime = Date.now();

    // 1. Load template
    const template = await this.getTemplateBySlug(dto.template_slug);
    if (!template) {
      throw new Error(`Template not found: ${dto.template_slug}`);
    }

    // 2. Create report record in 'pending' status
    const reportTitle = this.generateReportTitle(template.name, dto.primary_geography.name);

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
      const geoType = dto.primary_geography.type as 'metro' | 'county' | 'zip';
      const scores = await this.scoringService.getScore(dto.primary_geography.id, geoType);

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
        current: {},
        historical: {},
        benchmarks: {},
        scores: {
          homeready: scores
            ? {
              score: scores.homereadyScore,
              trend: 'stable',
              components: scores.homereadyComponents,
            }
            : undefined,
          investoredge: scores
            ? {
              score: scores.investoredgeScore,
              trend: 'stable',
              components: scores.investoredgeComponents,
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
            geography_name: dto.primary_geography.name,
            geography_type: dto.primary_geography.type,
            user_type: dto.user_type,
            scores,
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
          homeready_score: scores?.homereadyScore || null,
          investoredge_score: scores?.investoredgeScore || null,
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
      .select(`
        *,
        template:report_templates(slug, name, icon, config)
      `)
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
  async getReportHistory(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('reports')
      .select(`
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
      `)
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
      { id: Date.now().toString(), role: 'user', content, timestamp: new Date().toISOString() },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date().toISOString() },
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
      .select(`
        *,
        template:report_templates(slug, name, icon, config)
      `)
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
  private generateReportTitle(templateName: string, geographyName: string): string {
    // Shorten geography name if too long
    const shortGeoName = geographyName.length > 30
      ? geographyName.split(',')[0]
      : geographyName;
    return `${shortGeoName} - ${templateName}`;
  }
}
