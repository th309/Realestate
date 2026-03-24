/**
 * Platform API v1 - Metrics Controller
 *
 * Exposes raw metric snapshots (latest value per region) to external
 * consumers. Queries the zillow_* tables directly via Supabase.
 *
 * Endpoints:
 *   GET /api/v1/metrics/:metricId/:geoLevel        - All regions (paginated)
 *   GET /api/v1/metrics/:metricId/:geoLevel/:geoId  - Single region
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Inject,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';

const TABLE_MAP: Record<string, string> = {
  state: 'zillow_state',
  metro: 'zillow_metro',
  county: 'zillow_county',
  zip: 'zillow_zip',
};

const VALID_GEO_LEVELS = Object.keys(TABLE_MAP);

/** Maximum rows per page. */
const MAX_PAGE_LIMIT = 500;
const DEFAULT_PAGE_LIMIT = 100;

@Controller('api/v1/metrics')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class MetricsV1Controller {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly apiKeyValidator: ApiKeyValidatorService,
  ) {}

  /**
   * GET /api/v1/metrics/:metricId/:geoLevel
   *
   * Returns the latest value per region for a given metric and geography.
   * Cursor-based pagination using `cursor` (region_name to start after)
   * and `limit` (page size, default 100, max 500).
   */
  @Get(':metricId/:geoLevel')
  async getMetricSnapshot(
    @Param('metricId') metricId: string,
    @Param('geoLevel') geoLevel: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limitParam: string | undefined,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'metrics:read');
    this.validateGeoLevel(geoLevel);

    const limit = this.parseLimit(limitParam);
    const table = TABLE_MAP[geoLevel];

    let query = this.supabase
      .from(table)
      .select('region_id, region_name, value, period_date')
      .eq('metric_name', metricId)
      .order('region_name', { ascending: true })
      .limit(limit + 1); // N+1 pattern for next_cursor detection

    if (cursor) {
      query = query.gt('region_name', cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException({
        code: 'QUERY_ERROR',
        message: `Failed to fetch metric data: ${error.message}`,
      });
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageRows[pageRows.length - 1]?.region_name
      : null;

    return {
      metric: { id: metricId },
      geography_level: geoLevel,
      regions: pageRows.map((row: any) => ({
        id: row.region_id,
        name: row.region_name,
        value: row.value,
        date: row.period_date,
      })),
      pagination: {
        count: pageRows.length,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    };
  }

  /**
   * GET /api/v1/metrics/:metricId/:geoLevel/:geoId
   *
   * Returns the latest value for a single region.
   */
  @Get(':metricId/:geoLevel/:geoId')
  async getMetricForRegion(
    @Param('metricId') metricId: string,
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'metrics:read');
    this.validateGeoLevel(geoLevel);

    const table = TABLE_MAP[geoLevel];

    const { data, error } = await this.supabase
      .from(table)
      .select('region_id, region_name, value, period_date')
      .eq('metric_name', metricId)
      .eq('region_id', geoId)
      .order('period_date', { ascending: false })
      .limit(1);

    if (error) {
      throw new BadRequestException({
        code: 'QUERY_ERROR',
        message: `Failed to fetch metric data: ${error.message}`,
      });
    }

    if (!data || data.length === 0) {
      throw new NotFoundException({
        code: 'METRIC_NOT_FOUND',
        message: `No data found for metric '${metricId}' in ${geoLevel} ${geoId}`,
      });
    }

    const row = data[0];
    return {
      metric: { id: metricId },
      geography: {
        level: geoLevel,
        id: row.region_id,
        name: row.region_name,
      },
      value: row.value,
      date: row.period_date,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validateGeoLevel(geoLevel: string): void {
    if (!VALID_GEO_LEVELS.includes(geoLevel)) {
      throw new BadRequestException({
        code: 'INVALID_GEO_LEVEL',
        message: `Invalid geography level '${geoLevel}'. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
      });
    }
  }

  private parseLimit(raw: string | undefined): number {
    if (!raw) return DEFAULT_PAGE_LIMIT;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
    return Math.min(parsed, MAX_PAGE_LIMIT);
  }
}
