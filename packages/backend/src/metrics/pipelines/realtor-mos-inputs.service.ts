import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

@Injectable()
export class RealtorMosInputsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async fetchRealtorMosInputs(
    geoLevel: 'metro' | 'county' | 'zip',
  ): Promise<Map<string, { active: number; pending: number }>> {
    const table = `realtor_${geoLevel}`;
    const idCol =
      geoLevel === 'metro'
        ? 'cbsa_code'
        : geoLevel === 'county'
          ? 'county_fips'
          : 'postal_code';
    const { data: latest } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const out = new Map<string, { active: number; pending: number }>();
    if (!latest?.period_date) return out;
    let from = 0;
    const page = 1000;
    while (true) {
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, active_listing_count, pending_listing_count`)
        .eq('period_date', latest.period_date)
        .range(from, from + page - 1);
      if (error)
        throw new Error(`${table} MOS inputs failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        const id = r[idCol];
        if (!id) continue;
        const active = r.active_listing_count;
        const pending = r.pending_listing_count;
        if (active == null || pending == null) continue;
        out.set(String(id), {
          active: Number(active),
          pending: Number(pending),
        });
      }
      if (data.length < page) break;
      from += page;
    }
    return out;
  }
}
