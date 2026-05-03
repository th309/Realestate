import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface GeographyRow {
  geography_id: string;
  name: string | null;
}

@Injectable()
export class MigrationService {
  constructor(private readonly supabase: SupabaseService) {}

  async getFlows(
    source: 'irs' | 'redfin',
    fips: string,
    direction: 'in' | 'out',
    limit: number,
  ) {
    const client = this.supabase.getClient();

    if (source === 'irs') {
      const dirCol = direction === 'in' ? 'destination_fips' : 'origin_fips';
      const partnerCol =
        direction === 'in' ? 'origin_fips' : 'destination_fips';

      const { data, error } = await client
        .from('irs_county_migration_flows')
        .select(
          `tax_year, num_returns, num_exemptions, agi_thousands, ${partnerCol}`,
        )
        .eq(dirCol, fips)
        .order('num_returns', { ascending: false })
        .limit(limit + 5); // pad for filtering reserved partners

      if (error) throw error;

      const filtered = ((data ?? []) as any[])
        .filter((r) => r[partnerCol] !== '00000' && r[partnerCol] !== '99999')
        .slice(0, limit);

      const taxYear = filtered[0]?.tax_year ?? null;
      const partnerFipsList = filtered.map((r) => r[partnerCol] as string);
      const lookupIds = Array.from(new Set([fips, ...partnerFipsList]));

      const { data: geos } = await client
        .from('geographies')
        .select('geography_id, name')
        .in('geography_id', lookupIds);

      const geoMap = new Map<string, string | null>(
        ((geos ?? []) as GeographyRow[]).map((g) => [g.geography_id, g.name]),
      );

      const partnerKey =
        partnerCol === 'origin_fips' ? 'origin_fips' : 'destination_fips';
      const partnerNameKey =
        partnerCol === 'origin_fips' ? 'origin_name' : 'destination_name';

      return {
        geography: {
          fips,
          name: geoMap.get(fips) ?? null,
          level: 'county' as const,
        },
        source,
        direction,
        as_of: taxYear ? String(taxYear) : null,
        flows: filtered.map((r) => ({
          [partnerKey]: r[partnerCol] as string,
          [partnerNameKey]: geoMap.get(r[partnerCol] as string) ?? null,
          num_returns: r.num_returns,
          num_exemptions: r.num_exemptions,
          avg_agi:
            r.num_returns > 0
              ? Math.round((Number(r.agi_thousands) * 1000) / r.num_returns)
              : null,
        })),
      };
    }

    // redfin
    const dirCol = direction === 'in' ? 'destination_cbsa' : 'origin_cbsa';
    const partnerCol = direction === 'in' ? 'origin_cbsa' : 'destination_cbsa';

    const { data, error } = await client
      .from('redfin_migration_flows_metro')
      .select(`period_date, share_pct, net_searches, ${partnerCol}`)
      .eq(dirCol, fips)
      .order('share_pct', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const periodDate = rows[0]?.period_date ?? null;
    const partnerList = rows.map((r) => r[partnerCol] as string);
    const lookupIds = Array.from(new Set([fips, ...partnerList]));

    const { data: geos } = await client
      .from('geographies')
      .select('geography_id, name')
      .in('geography_id', lookupIds);

    const geoMap = new Map<string, string | null>(
      ((geos ?? []) as GeographyRow[]).map((g) => [g.geography_id, g.name]),
    );

    const partnerKey =
      partnerCol === 'origin_cbsa' ? 'origin_cbsa' : 'destination_cbsa';
    const partnerNameKey =
      partnerCol === 'origin_cbsa' ? 'origin_name' : 'destination_name';

    return {
      geography: {
        fips,
        name: geoMap.get(fips) ?? null,
        level: 'metro' as const,
      },
      source,
      direction,
      as_of: periodDate,
      flows: rows.map((r) => ({
        [partnerKey]: r[partnerCol] as string,
        [partnerNameKey]: geoMap.get(r[partnerCol] as string) ?? null,
        share_pct: r.share_pct,
        net_searches: r.net_searches,
      })),
    };
  }
}
