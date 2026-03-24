/**
 * Embed Data Controller
 *
 * Public-facing endpoints that serve widget data for embedded components.
 * Protected by EmbedTokenGuard (validates token, origin, and widget type)
 * and EmbedCorsInterceptor (sets dynamic CORS headers).
 *
 * Endpoints:
 *   GET /api/embed/score/:geoLevel/:geoId     — Score data for score widget
 *   GET /api/embed/metric-card/:metricId/:geoLevel/:geoId — Single metric value
 *   GET /api/embed/map/:geoLevel?metric=...    — Snapshot metric data for map
 *   GET /api/embed/branding                    — Org branding from token
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { EmbedTokenGuard } from './embed-token.guard';
import { EmbedCorsInterceptor } from './embed-cors.interceptor';

@Controller('api/embed')
@UseGuards(EmbedTokenGuard)
@UseInterceptors(EmbedCorsInterceptor)
export class EmbedDataController {
  private readonly logger = new Logger(EmbedDataController.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Get score data for the score embed widget.
   */
  @Get('score/:geoLevel/:geoId')
  async getEmbedScore(
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
  ) {
    this.validateGeoLevel(geoLevel);

    const score = await this.scoringService.getScore(
      geoId,
      geoLevel as 'metro' | 'county' | 'zip',
    );

    if (!score) {
      throw new HttpException(
        `No scores found for ${geoLevel}/${geoId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      geography_name: score.location_name,
      scores: score.scores,
    };
  }

  /**
   * Get a single metric value with trend for the metric card widget.
   */
  @Get('metric-card/:metricId/:geoLevel/:geoId')
  async getEmbedMetricCard(
    @Param('metricId') metricId: string,
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
  ) {
    this.validateGeoLevel(geoLevel);

    const metricData = await this.fetchMetricValue(metricId, geoLevel, geoId);

    if (!metricData) {
      throw new HttpException(
        `No data found for metric ${metricId} at ${geoLevel}/${geoId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return metricData;
  }

  /**
   * Get snapshot metric data for the map embed widget.
   */
  @Get('map/:geoLevel')
  async getEmbedMap(
    @Param('geoLevel') geoLevel: string,
    @Query('metric') metricId: string,
  ) {
    this.validateGeoLevel(geoLevel);

    if (!metricId) {
      throw new HttpException(
        'metric query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const metricData = await this.fetchMapMetricData(metricId, geoLevel);

    return {
      metric_id: metricId,
      geo_level: geoLevel,
      data: metricData,
    };
  }

  /**
   * Get org branding info from the validated embed token.
   */
  @Get('branding')
  async getEmbedBranding(@Req() request: any) {
    const embedOrg = request.embedOrg;

    if (!embedOrg) {
      return { logo_url: null, accent_color: null, org_name: null };
    }

    return embedOrg.branding;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private validateGeoLevel(geoLevel: string): void {
    const valid = ['metro', 'county', 'zip'];
    if (!valid.includes(geoLevel.toLowerCase())) {
      throw new HttpException(
        `Invalid geoLevel: ${geoLevel}. Valid: ${valid.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Fetch a single metric's current value and trend for one geography.
   * Queries the appropriate Zillow/Realtor table based on geo level.
   */
  private async fetchMetricValue(
    metricId: string,
    geoLevel: string,
    geoId: string,
  ) {
    const tableMap: Record<string, string> = {
      metro: 'zillow_metro',
      county: 'zillow_county',
      zip: 'zillow_zip',
    };

    const idFieldMap: Record<string, string> = {
      metro: 'cbsa_code',
      county: 'county_fips',
      zip: 'postal_code',
    };

    const table = tableMap[geoLevel];
    const idField = idFieldMap[geoLevel];

    if (!table || !idField) return null;

    // Get latest value
    const { data: latestRows, error } = await this.supabase
      .from(table)
      .select('region_name, value, period_date')
      .eq(idField, geoId)
      .eq('metric_name', metricId)
      .order('period_date', { ascending: false })
      .limit(4); // Latest + 3 months ago for trend

    if (error || !latestRows?.length) {
      this.logger.debug(
        `No metric data for ${metricId} at ${geoLevel}/${geoId}: ${error?.message ?? 'no rows'}`,
      );
      return null;
    }

    const latest = latestRows[0];
    const threeMonthsAgo = latestRows.length >= 4 ? latestRows[3] : null;

    let trend: number | null = null;
    if (threeMonthsAgo && latest.value && threeMonthsAgo.value) {
      trend =
        ((latest.value - threeMonthsAgo.value) / threeMonthsAgo.value) * 100;
    }

    return {
      metric_id: metricId,
      geography_name: latest.region_name,
      value: latest.value,
      period_date: latest.period_date,
      trend: trend ? Math.round(trend * 100) / 100 : null,
    };
  }

  /**
   * Fetch metric snapshot data for all regions at a geography level (for maps).
   * Returns the latest value per region.
   */
  private async fetchMapMetricData(metricId: string, geoLevel: string) {
    const tableMap: Record<string, string> = {
      metro: 'zillow_metro',
      county: 'zillow_county',
      zip: 'zillow_zip',
    };

    const idFieldMap: Record<string, string> = {
      metro: 'cbsa_code',
      county: 'county_fips',
      zip: 'postal_code',
    };

    const table = tableMap[geoLevel];
    const idField = idFieldMap[geoLevel];

    if (!table || !idField) return [];

    // Get latest date for this metric
    const { data: dateRow } = await this.supabase
      .from(table)
      .select('period_date')
      .eq('metric_name', metricId)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!dateRow) return [];

    // Fetch all regions for that date
    const { data, error } = await this.supabase
      .from(table)
      .select(`${idField}, region_name, value`)
      .eq('metric_name', metricId)
      .eq('period_date', dateRow.period_date)
      .limit(5000);

    if (error) {
      this.logger.error(
        `Failed to fetch map data for ${metricId}/${geoLevel}: ${error.message}`,
      );
      return [];
    }

    return (data ?? []).map((row: any) => ({
      region_id: row[idField],
      region_name: row.region_name,
      value: row.value,
    }));
  }
}
