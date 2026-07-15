import { SupabaseClient } from '@supabase/supabase-js';
import { getMetricMapping } from '../timeseries/timeseries-metric-mapping';
import { getTableName } from '../timeseries/timeseries-region-filter';
import { MetricRow } from './align-series';
import { stateFipsByName, stateFipsByAbbr } from './us-states';

const PAGE = 1000;

/** Native state table key column per source (maps to state_fips via US_STATES). */
function stateKeyColumn(source: string): {
  col: string;
  toFips: (v: string) => string | undefined;
} {
  if (source === 'realtor')
    return {
      col: 'state_id',
      toFips: (v) => stateFipsByAbbr[String(v).toUpperCase()],
    };
  // zillow_state keys on the full state name in region_name
  return {
    col: 'region_name',
    toFips: (v) => stateFipsByName[String(v).toLowerCase()],
  };
}

/**
 * State-level series keyed by state_fips.
 * PropertyIQ Score → mean-of-metros via RPC. All other metrics → native state table.
 */
export async function fetchStateMetricSeries(
  supabase: SupabaseClient,
  metricId: string,
  startDate: string,
): Promise<MetricRow[]> {
  if (metricId === 'propertyiq_score') {
    const { data, error } = await supabase.rpc('me_state_score_series', {
      p_start: startDate,
    });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      regionId: String(r.state_fips),
      date: String(r.score_date),
      value: r.avg_score == null ? null : Number(r.avg_score),
    }));
  }

  const mapping = getMetricMapping(metricId);
  if (!mapping) return [];
  const table = getTableName(mapping.source, 'state');
  if (!table) return [];
  const { col, toFips } = stateKeyColumn(mapping.source);

  const rows: MetricRow[] = [];
  let offset = 0;
  let page: any[];
  do {
    let q = supabase
      .from(table)
      .select(`${col}, period_date, ${mapping.columnName}`)
      .gte('period_date', startDate)
      .order('period_date', { ascending: true });
    if (mapping.usesMetricName && mapping.source === 'zillow') {
      q = q.eq('metric_name', mapping.metricNameValue!);
    }
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) break;
    page = (data ?? []) as any[];
    for (const r of page) {
      const fips = toFips(r[col]);
      if (!fips) continue;
      rows.push({
        regionId: fips,
        date: String(r.period_date),
        value:
          r[mapping.columnName] == null ? null : Number(r[mapping.columnName]),
      });
    }
    offset += page.length;
  } while (page.length === PAGE);
  return rows;
}
