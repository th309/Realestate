import {
  Controller,
  Get,
  Header,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';

const VALID_GEO_LEVELS: GeoLevel[] = [
  'zip',
  'county',
  'metro',
  'state',
  'national',
];

/**
 * Public single-metric resolution endpoint.
 *
 * Resolves the latest value for ANY registered metric at a single geography by
 * delegating to MetricResolutionService — the platform's source of truth for
 * source fallback (e.g. ces -> qcew) and geography inheritance. Unlike the
 * per-family literal routes on the sibling controllers (`cap-rate/metros`,
 * `income-to-buy/counties`, ...), this serves arbitrary metric ids — QCEW
 * employment supersectors, IRS migration aggregates, etc. — that have no
 * dedicated route.
 *
 * Public + unauthenticated by design: it mirrors the other `api/metrics` reads
 * and is the surface the MCP server's `x-user-id`-only requests call. (The
 * equivalent `/api/v1/metrics` route is API-key gated AND queries only the
 * `zillow_*` tables, so it structurally cannot serve these source-routed
 * metrics — which is why the MCP's `get_employment_by_sector` /
 * `get_migration_summary` calls were silently returning empty.)
 */
@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsResolveController {
  constructor(private readonly metricResolution: MetricResolutionService) {}

  /**
   * GET /api/metrics/resolve/:metricId/:geoLevel/:geoId
   *
   * Returns the latest resolved value for a single metric + geography.
   * Always 200: a metric/geography with no data resolves to `value: null`
   * (`source: "none"`) rather than 404, so callers can distinguish genuine
   * "no data" from a transport/route error.
   */
  @Get('resolve/:metricId/:geoLevel/:geoId')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({
    summary:
      'Resolve the latest value for a single metric at a single geography (source fallback + geo inheritance)',
  })
  @ApiParam({
    name: 'metricId',
    description: 'Registered metric id, e.g. employment_construction',
  })
  @ApiParam({ name: 'geoLevel', enum: VALID_GEO_LEVELS })
  @ApiParam({
    name: 'geoId',
    description: 'Geography id: state code, CBSA code, county FIPS, or ZIP',
  })
  async resolve(
    @Param('metricId') metricId: string,
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
  ) {
    if (!VALID_GEO_LEVELS.includes(geoLevel as GeoLevel)) {
      throw new BadRequestException(
        `Invalid geoLevel '${geoLevel}'. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
      );
    }

    const resolved = await this.metricResolution.resolveMetric(
      metricId,
      geoLevel as GeoLevel,
      geoId,
    );

    return {
      metricId,
      geoLevel,
      geoId,
      value: resolved.value,
      date: resolved.date,
      source: resolved.source,
      isInherited: resolved.isInherited,
      isFallback: resolved.isFallback,
    };
  }
}
