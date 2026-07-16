import { SupabaseClient } from '@supabase/supabase-js';
import { getMetricMapping } from '../timeseries/timeseries-metric-mapping';
import { getTableName } from '../timeseries/timeseries-region-filter';
import { MetricRow } from './align-series';

const PAGE = 1000;

/** Column to use with `.in(col, ids)` for a (source, geoLevel) batch read. */
export function batchIdColumn(source: string, geoLevel: string): string {
  if (source === 'propertyiq') return 'location_id';
  if (source === 'realtor') {
    return geoLevel === 'metro'
      ? 'cbsa_code'
      : geoLevel === 'county'
        ? 'county_fips'
        : 'postal_code';
  }
  // zillow (and any period_date source keyed like zillow)
  return geoLevel === 'metro'
    ? 'cbsa_code'
    : geoLevel === 'county'
      ? 'fips_code'
      : 'region_name';
}

function dateField(source: string): string {
  return source === 'propertyiq' ? 'score_date' : 'period_date';
}

/**
 * ONE metric across MANY regions in a single paginated query.
 * Only supports the direct sources this feature reads (zillow/realtor/propertyiq).
 */
export async function fetchMetricSeriesForRegions(
  supabase: SupabaseClient,
  metricId: string,
  geoLevel: string,
  regionIds: string[],
  startDate: string,
): Promise<MetricRow[]> {
  const mapping = getMetricMapping(metricId);
  if (!mapping || !regionIds.length) return [];
  const table = getTableName(mapping.source, geoLevel);
  if (!table) return [];

  const df = dateField(mapping.source);
  const idCol = batchIdColumn(mapping.source, geoLevel);
  const valCol = mapping.columnName;

  const rows: MetricRow[] = [];
  // Chunk the id list, paginate each chunk.
  for (let c = 0; c < regionIds.length; c += 300) {
    const chunk = regionIds.slice(c, c + 300);
    let offset = 0;
    let page: any[];
    do {
      let q = supabase
        .from(table)
        .select(`${idCol}, ${df}, ${valCol}`)
        .in(idCol, chunk)
        .gte(df, startDate)
        .order(df, { ascending: true });
      if (mapping.source === 'propertyiq') {
        q = q
          .eq('score_type', mapping.metricNameValue!)
          .eq('geography', geoLevel);
      } else if (mapping.usesMetricName && mapping.source === 'zillow') {
        q = q.eq('metric_name', mapping.metricNameValue!);
      }
      const { data, error } = await q.range(offset, offset + PAGE - 1);
      if (error) break;
      page = (data ?? []) as any[];
      for (const r of page) {
        rows.push({
          regionId: String(r[idCol]),
          date: String(r[df]),
          value: r[valCol] == null ? null : Number(r[valCol]),
        });
      }
      offset += page.length;
    } while (page.length === PAGE);
  }
  return rows;
}
