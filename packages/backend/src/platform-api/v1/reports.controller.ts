/**
 * Platform API v1 — Reports Controller
 *
 * Async report generation (POST → poll pattern) and listing for org-scoped
 * API key consumers. Reports are generated using the same pipeline as the
 * web app but triggered programmatically via API keys.
 *
 * Endpoints:
 *   POST /api/v1/reports        — Start async report generation
 *   GET  /api/v1/reports/:id    — Poll / fetch a single report
 *   GET  /api/v1/reports        — List org's reports (cursor pagination)
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Inject,
  UseGuards,
  UseInterceptors,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { ReportsService } from '../../reports/reports.service';
import {
  GenerateReportDto,
  GeographyDto,
} from '../../reports/dto/generate-report.dto';

// ── Request body for Platform API report creation ────────────────────────

interface CreateReportBody {
  geography_level: string;
  geography_id: string;
  report_type: string;
  include_ai_narrative?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Resolve the org owner user ID from the organizations table. */
async function getOrgOwnerId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single();

  if (error || !data?.owner_id) {
    throw new HttpException(
      { code: 'ORG_NOT_FOUND', message: 'Organization not found' },
      HttpStatus.NOT_FOUND,
    );
  }

  return data.owner_id;
}

// ── Controller ───────────────────────────────────────────────────────────

@Controller('api/v1/reports')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class PlatformReportsController {
  private readonly logger = new Logger(PlatformReportsController.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly reportsService: ReportsService,
    private readonly apiKeyValidator: ApiKeyValidatorService,
  ) {}

  /**
   * POST /api/v1/reports
   *
   * Start async report generation. Returns immediately with a poll URL.
   * The caller should GET /api/v1/reports/:id until status is 'complete'.
   */
  @Post()
  async create(@Req() req: any, @Body() body: CreateReportBody) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'reports:write');

    if (!body.geography_level || !body.geography_id || !body.report_type) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message:
            'geography_level, geography_id, and report_type are required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ownerId =
      source === 'user' ? userId : await getOrgOwnerId(this.supabase, orgId);

    // Build the internal GenerateReportDto from the API body
    const geography = new GeographyDto();
    geography.id = body.geography_id;
    geography.type = body.geography_level as GeographyDto['type'];
    geography.name = `${body.geography_level}:${body.geography_id}`;

    const dto = new GenerateReportDto();
    dto.template_slug = body.report_type;
    dto.user_type = 'investor'; // API consumers default to investor
    dto.primary_geography = geography;

    this.logger.log(
      `API report generation: org=${orgId} geo=${body.geography_level}/${body.geography_id} type=${body.report_type}`,
    );

    const reportId = await this.reportsService.generateReport(
      ownerId,
      dto,
      source === 'user' ? 'pro' : 'enterprise',
    );

    // Tag the report with the org so GET queries can scope by org
    if (orgId) {
      await this.supabase
        .from('reports')
        .update({ organization_id: orgId })
        .eq('id', reportId);
    }

    return {
      id: reportId,
      status: 'generating',
      poll_url: `/api/v1/reports/${reportId}`,
    };
  }

  /**
   * GET /api/v1/reports/:id
   *
   * Fetch a single report. If still generating, returns partial status.
   * Verifies the report belongs to the requesting org.
   */
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') reportId: string) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'reports:read');

    const { data: report, error } = await this.supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !report) {
      throw new HttpException(
        { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Verify ownership — report must belong to this user or org
    if (source === 'user') {
      if (report.user_id !== userId) {
        throw new HttpException(
          { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      if (report.organization_id !== orgId) {
        const ownerId = await getOrgOwnerId(this.supabase, orgId);
        if (report.user_id !== ownerId) {
          throw new HttpException(
            { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
            HttpStatus.NOT_FOUND,
          );
        }
      }
    }

    // If still generating, return minimal status
    if (report.status === 'generating') {
      return {
        id: report.id,
        status: 'generating',
        generation_stage: report.generation_stage ?? null,
      };
    }

    // Return full report for completed reports
    return {
      id: report.id,
      status: report.status,
      title: report.title,
      report_type: report.report_type,
      geography: {
        level: report.primary_geography_type,
        id: report.primary_geography_id,
        name: report.primary_geography_name,
      },
      scores: {
        propertyiq: report.propertyiq_score ?? report.homeready_score ?? null,
      },
      metrics: report.populated_data ?? null,
      ai_narrative: report.ai_narratives ?? null,
      branding: report.branding ?? null,
      created_at: report.created_at,
      data_as_of_date: report.data_as_of_date ?? null,
    };
  }

  /**
   * GET /api/v1/reports
   *
   * List reports belonging to this org. Cursor-based pagination using
   * created_at DESC. Query params: ?limit=20&cursor=2026-03-20T00:00:00Z
   */
  @Get()
  async findAll(
    @Req() req: any,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'reports:read');

    const limit = Math.min(
      Math.max(parseInt(limitStr || '20', 10) || 20, 1),
      100,
    );

    let query = this.supabase
      .from('reports')
      .select(
        'id, title, report_type, status, primary_geography_type, primary_geography_id, primary_geography_name, propertyiq_score, homeready_score, created_at',
      );

    if (source === 'user') {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('organization_id', orgId);
    }

    query = query.order('created_at', { ascending: false }).limit(limit + 1); // Fetch one extra to detect next page

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list reports for org ${orgId}: ${error.message}`,
      );
      throw new HttpException(
        { code: 'LIST_FAILED', message: 'Failed to list reports' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const items = data || [];
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

    return {
      items: page,
      pagination: {
        count: page.length,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    };
  }
}
