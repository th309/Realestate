/**
 * PropertyIQ Reports Service
 *
 * Thin orchestration layer that wires NestJS DI to extracted modules:
 * - reports-orchestrator.ts: Core async generation pipeline
 * - reports-data-fetcher.ts: Market metrics, benchmarks, historical data
 * - reports-score-context.ts: Score contextualization & formatting
 * - reports-market-comparison.ts: Priority-weighted market comparisons
 * - reports-sharing.ts: Share links & conversations
 * - reports-narratives.ts: AI narrative generation (per-section v2)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { ClaudeService } from './claude.service';
import { ClaudeNewsService } from './claude-news.service';
import { TimeSeriesService } from '../timeseries/timeseries.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PartnersService } from '../partners/partners.service';
import { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { generateReportAsync, ReportDeps } from './reports-orchestrator';
import {
  sendConversationMessage as sendConversationMessageFn,
  getConversation as getConversationFn,
  createShareLink as createShareLinkFn,
  getSharedReport as getSharedReportFn,
} from './reports-sharing';
import {
  regenerateNarratives as regenerateNarrativesFn,
} from './reports-narratives';

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

// Re-export types for consumers
export type { ScoreContext } from './reports-score-context';
export type { HistoricalMetricData, HistoricalData } from './reports-data-fetcher';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
    private readonly claudeNewsService: ClaudeNewsService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly entitlementsService: EntitlementsService,
    private readonly partnersService: PartnersService,
    private readonly marketSnapshotService: MarketSnapshotService,
    private readonly metricResolutionService: MetricResolutionService,
  ) {}

  // ============================================================================
  // Template CRUD
  // ============================================================================

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

  // ============================================================================
  // Report Generation
  // ============================================================================

  async generateReport(
    userId: string,
    dto: GenerateReportDto,
    userTier?: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const startTime = Date.now();

    const template = await this.getTemplateBySlug(dto.template_slug);
    if (!template) {
      throw new Error(`Template not found: ${dto.template_slug}`);
    }

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

    // Kick off async generation pipeline (fire-and-forget)
    const deps: ReportDeps = {
      supabase: client,
      logger: this.logger,
      scoringService: this.scoringService,
      claudeService: this.claudeService,
      claudeNewsService: this.claudeNewsService,
      entitlementsService: this.entitlementsService,
      partnersService: this.partnersService,
      marketSnapshotService: this.marketSnapshotService,
      timeSeriesService: this.timeSeriesService,
      metricResolutionService: this.metricResolutionService,
    };
    generateReportAsync(deps, report.id, template, dto, startTime, userId, userTier);

    return report.id;
  }

  // ============================================================================
  // Report Retrieval & Deletion
  // ============================================================================

  async getReport(reportId: string, userId?: string): Promise<any> {
    const client = this.supabase.getClient();
    let query = client
      .from('reports')
      .select(`*, template:report_templates(slug, name, icon, config)`)
      .eq('id', reportId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();
    if (error) {
      this.logger.error(`Failed to fetch report ${reportId}:`, error);
      return null;
    }

    await client
      .from('reports')
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('id', reportId);

    return data;
  }

  async getReportHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('reports')
      .select(`
        id, title, report_type, user_type,
        primary_geography_name, primary_geography_type,
        homeready_score, investoredge_score,
        status, data_as_of_date, created_at,
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

  // ============================================================================
  // Sharing & Conversations (delegates to reports-sharing.ts)
  // ============================================================================

  async sendConversationMessage(
    reportId: string,
    userId: string,
    content: string,
    userTier?: string,
  ): Promise<any> {
    return sendConversationMessageFn(
      this.supabase.getClient(),
      {
        claudeService: this.claudeService,
        claudeNewsService: this.claudeNewsService,
        entitlementsService: this.entitlementsService,
        getReport: (rid, uid) => this.getReport(rid, uid),
      },
      reportId,
      userId,
      content,
      userTier,
    );
  }

  async getConversation(reportId: string, userId: string): Promise<any> {
    return getConversationFn(this.supabase.getClient(), reportId, userId);
  }

  async createShareLink(
    reportId: string,
    userId: string,
    accessLevel: 'view' | 'download',
    expiresInDays?: number,
  ): Promise<string> {
    return createShareLinkFn(this.supabase.getClient(), reportId, userId, accessLevel, expiresInDays);
  }

  async getSharedReport(token: string): Promise<any> {
    return getSharedReportFn(this.supabase.getClient(), token);
  }

  // ============================================================================
  // Narrative Regeneration (delegates to reports-narratives.ts)
  // ============================================================================

  async regenerateNarratives(
    reportId: string,
    userId: string,
    userInputs: Record<string, any>,
    userTier?: string,
  ): Promise<{ updated_keys: string[]; ai_narrative: Record<string, any> }> {
    return regenerateNarrativesFn(
      this.supabase.getClient(),
      this.logger,
      reportId,
      userId,
      userInputs,
      userTier,
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateReportTitle(templateName: string, geographyName: string): string {
    const shortGeoName = geographyName.length > 30 ? geographyName.split(',')[0] : geographyName;
    return `${shortGeoName} - ${templateName}`;
  }
}
