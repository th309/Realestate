import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScopeQueryDto } from './market-explorer.dto';
import { ScopeSeriesResponse } from './market-explorer.types';
import { resolveChildRegions } from './resolve-child-regions';
import { fetchMetricSeriesForRegions } from './fetch-metric-series';
import { fetchStateMetricSeries } from './fetch-state-series';
import { stateRegions } from './us-states';
import { alignSeriesToAxis } from './align-series';

/** First-of-month ISO string `months` months back from today (inclusive window start). */
function windowStart(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

@Injectable()
export class MarketExplorerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const startDate = windowStart(dto.months);

    let regions;
    let rows;
    if (geoLevel === 'state') {
      regions = stateRegions();
      rows = await fetchStateMetricSeries(this.supabase, dto.metric, startDate);
    } else {
      regions = await resolveChildRegions(
        this.supabase,
        geoLevel,
        dto.parentLevel,
        dto.parentId,
        !!dto.includeNearby,
      );
      rows = await fetchMetricSeriesForRegions(
        this.supabase,
        dto.metric,
        geoLevel,
        regions.map((r) => r.id),
        startDate,
      );
    }

    const { dates, series } = alignSeriesToAxis(rows, dto.months);
    return {
      success: true,
      geoLevel,
      metric: dto.metric,
      months: dto.months,
      dates,
      regions,
      series,
    };
  }
}
