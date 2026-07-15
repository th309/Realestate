import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScopeQueryDto } from './market-explorer.dto';
import { ScopeSeriesResponse } from './market-explorer.types';

@Injectable()
export class MarketExplorerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // Real implementation lands in Task 6; stub keeps the controller wireable.
  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    return {
      success: true,
      geoLevel,
      metric: dto.metric,
      months: dto.months,
      dates: [],
      regions: [],
      series: {},
    };
  }
}
