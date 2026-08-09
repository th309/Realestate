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
import { ReportAiService } from './report-ai.service';
import { NewsScoutService } from './news-scout.service';
import { TimeSeriesService } from '../timeseries/timeseries.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PartnersService } from '../partners/partners.service';
import { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { ReportGenerationV2Service } from './report-generation-v2.service';
import {
  GenerateReportDto,
  SaveBuilderTemplateDto,
} from './dto/generate-report.dto';
import { generateReportAsync, ReportDeps } from './reports-orchestrator';
import { ReportTemplateCatalogService } from './report-template-catalog.service';

// Re-export types for consumers
export type { ReportTemplate } from './report-template-catalog.service';
export type { ScoreContext } from './reports-score-context';
export type {
  HistoricalMetricData,
  HistoricalData,
} from './reports-data-fetcher';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoringService: ScoringService,
    private readonly reportAiService: ReportAiService,
    private readonly newsScoutService: NewsScoutService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly entitlementsService: EntitlementsService,
    private readonly partnersService: PartnersService,
    private readonly marketSnapshotService: MarketSnapshotService,
    private readonly metricResolutionService: MetricResolutionService,
    private readonly reportGenerationV2: ReportGenerationV2Service,
    private readonly reportTemplateCatalog: ReportTemplateCatalogService,
  ) {}

  // ============================================================================
  // Template CRUD (catalog reads delegate to ReportTemplateCatalogService)
  // ============================================================================

  /**
   * Persist a report-builder layout as a private, user-owned template row in
   * report_templates (is_public=false so it never enters the public catalog).
   * The table was built for this: created_by is the owner, config holds the
   * section structure. Returns the new template's id + slug.
   */
  async saveBuilderTemplate(
    userId: string,
    dto: SaveBuilderTemplateDto,
  ): Promise<{ id: string; slug: string }> {
    const client = this.supabase.getClient();
    const slug = `custom-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

    const { data, error } = await client
      .from('report_templates')
      .insert({
        slug,
        name: dto.title,
        description: 'Custom builder template',
        icon: 'FileText',
        tier_required: 'free',
        is_active: true,
        is_public: false,
        config: { sections: dto.sections, userType: dto.user_type },
        created_by: userId,
      })
      .select('id, slug')
      .single();

    if (error || !data) {
      this.logger.error('Failed to save builder template:', error);
      throw new Error('Failed to save builder template');
    }

    return { id: data.id, slug: data.slug };
  }

  // ============================================================================
  // Report Generation
  // ============================================================================

  async generateReport(
    userId: string,
    dto: GenerateReportDto,
    // Trusted, server-derived tier override (e.g. the platform API grants pro/
    // enterprise by validated API-key type). The user-facing controller passes
    // nothing → tier resolves from the validated userId. NEVER wire this to a
    // client-supplied header (that was the privilege-escalation bug).
    userTier?: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const startTime = Date.now();

    const template = await this.reportTemplateCatalog.getTemplateBySlug(
      dto.template_slug,
    );
    if (!template) {
      throw new Error(`Template not found: ${dto.template_slug}`);
    }

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

    // Kick off async generation pipeline (fire-and-forget)
    const deps: ReportDeps = {
      supabase: client,
      logger: this.logger,
      scoringService: this.scoringService,
      newsScoutService: this.newsScoutService,
      entitlementsService: this.entitlementsService,
      partnersService: this.partnersService,
      marketSnapshotService: this.marketSnapshotService,
      timeSeriesService: this.timeSeriesService,
      metricResolutionService: this.metricResolutionService,
      reportGenerationV2: this.reportGenerationV2,
    };
    generateReportAsync(
      deps,
      report.id,
      template,
      dto,
      startTime,
      userId,
      userTier,
    );

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
      .select(
        `
        id, title, report_type, user_type,
        primary_geography_name, primary_geography_type,
        homeready_score, investoredge_score,
        status, data_as_of_date, created_at,
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

  // Sharing, conversations, and narrative regeneration live in
  // ReportsSharingService / ReportsNarrativeRegenerationService — see
  // reports.controller.ts, which injects those directly.

  // ── Private Helpers ──────────────────────────────────────────────

  private generateReportTitle(
    templateName: string,
    geographyName: string,
  ): string {
    const shortGeoName =
      geographyName.length > 30 ? geographyName.split(',')[0] : geographyName;
    return `${shortGeoName} - ${templateName}`;
  }
}
