/**
 * Platform API v1 - Timeseries Controller
 *
 * Returns historical metric values for a single geography, ordered
 * chronologically. Queries the zillow_* tables directly via Supabase.
 *
 * Endpoint:
 *   GET /api/v1/timeseries/:metricId/:geoLevel/:geoId
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

/** Maximum rows returned for a single timeseries request. */
const MAX_TIMESERIES_ROWS = 1000;

@Controller('api/v1/timeseries')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class TimeseriesV1Controller {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly apiKeyValidator: ApiKeyValidatorService,
  ) {}

  /**
   * GET /api/v1/timeseries/:metricId/:geoLevel/:geoId
   *
   * Returns historical values for a metric at a specific geography.
   *
   * Query params:
   *   start - ISO date string for range start (inclusive)
   *   end   - ISO date string for range end (inclusive)
   */
  @Get(':metricId/:geoLevel/:geoId')
  async getTimeseries(
    @Param('metricId') metricId: string,
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'metrics:read');
    this.validateGeoLevel(geoLevel);

    if (start && !this.isValidIsoDate(start)) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: `Invalid start date '${start}'. Expected ISO format YYYY-MM-DD.`,
      });
    }
    if (end && !this.isValidIsoDate(end)) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: `Invalid end date '${end}'. Expected ISO format YYYY-MM-DD.`,
      });
    }

    const table = TABLE_MAP[geoLevel];

    let query = this.supabase
      .from(table)
      .select('region_id, region_name, value, period_date')
      .eq('metric_name', metricId)
      .eq('region_id', geoId)
      .order('period_date', { ascending: true })
      .limit(MAX_TIMESERIES_ROWS);

    if (start) {
      query = query.gte('period_date', start);
    }
    if (end) {
      query = query.lte('period_date', end);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException({
        code: 'QUERY_ERROR',
        message: `Failed to fetch timeseries data: ${error.message}`,
      });
    }

    if (!data || data.length === 0) {
      throw new NotFoundException({
        code: 'TIMESERIES_NOT_FOUND',
        message: `No timeseries data found for metric '${metricId}' in ${geoLevel} ${geoId}`,
      });
    }

    const regionName = data[0]?.region_name ?? geoId;

    return {
      metric: { id: metricId },
      geography: {
        level: geoLevel,
        id: geoId,
        name: regionName,
      },
      series: data.map((row: any) => ({
        date: row.period_date,
        value: row.value,
      })),
      count: data.length,
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

  private isValidIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
  }
}
