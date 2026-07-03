import { Controller, Get, Param, Header } from '@nestjs/common';
import { RedfinDcSnapshotService } from './redfin-dc-snapshot.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';

/** Frontend snapshot fetcher passes plural geo path segments. */
const GEO_PATH_MAP: Record<string, GeoLevel> = {
  national: 'national',
  states: 'state',
  metros: 'metro',
  counties: 'county',
  zips: 'zip',
};

/**
 * Map-choropleth snapshots for Redfin Data Center display metrics.
 * Route: GET /api/metrics/redfin-dc/:metricId/:geo  (e.g. .../sold_above_list_share/metros)
 * The metricId must be a redfin_dc* metric in the fallback registry; the service
 * enforces that scope. Registry-driven — no per-metric code here.
 */
@Controller('api/metrics/redfin-dc')
export class RedfinDcSnapshotController {
  constructor(private readonly service: RedfinDcSnapshotService) {}

  @Get(':metricId/:geo')
  @Header('Cache-Control', 'public, max-age=21600')
  async getSnapshot(
    @Param('metricId') metricId: string,
    @Param('geo') geo: string,
  ) {
    const geoLevel = GEO_PATH_MAP[geo];
    if (!geoLevel) {
      return {
        success: false,
        count: 0,
        metric: metricId,
        geography: geo,
        date: null,
        data: [],
      };
    }
    return this.service.getSnapshot(metricId, geoLevel);
  }
}
