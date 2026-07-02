import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateRegionId,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';
import { GeoType } from './market-snapshot.types';
import { ZILLOW_METRIC_MAP, ZILLOW_AFFORD_MAP } from './market-snapshot.types';

export async function fetchZillow(
  supabase: SupabaseClient,
  logger: Logger,
  geoType: GeoType,
  geoId: string,
): Promise<{
  rows: Record<string, any>[];
  name: string | null;
} | null> {
  const table = `zillow_${geoType}`;

  // Determine filter column and value per geo type
  let filterCol: string;
  let filterVal: string;

  if (geoType === 'metro') {
    filterCol = 'cbsa_code';
    filterVal = normalizeCbsaCode(geoId);
  } else if (geoType === 'county') {
    filterCol = 'fips_code';
    filterVal = normalizeCountyFips(geoId);
  } else if (geoType === 'zip') {
    filterCol = 'region_name';
    filterVal = normalizeZipKey(geoId);
  } else {
    filterCol = 'state_code';
    filterVal = normalizeStateRegionId(geoId)?.stateCode ?? geoId;
  }

  // Query each Zillow metric individually in parallel.
  // The zillow_zip table is very large and .in() queries cause statement timeouts,
  // but individual .eq() queries with .limit(1) are fast (~50ms each).
  const allMetricNames = [
    ...Object.keys(ZILLOW_METRIC_MAP),
    ...Object.keys(ZILLOW_AFFORD_MAP),
  ];

  const metricResults = await Promise.allSettled(
    allMetricNames.map(async (metricName) => {
      const { data, error } = await supabase
        .from(table)
        .select('metric_name, value, period_date, region_name')
        .eq(filterCol, filterVal)
        .eq('metric_name', metricName)
        .order('period_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return data[0] as Record<string, any>;
    }),
  );

  const rows: Record<string, any>[] = [];
  let name: string | null = null;
  for (const r of metricResults) {
    if (r.status === 'fulfilled' && r.value) {
      rows.push(r.value);
      if (!name && r.value.region_name) name = String(r.value.region_name);
    }
  }

  if (rows.length === 0) {
    logger.warn(
      `fetchZillow no data for ${geoType}/${geoId} from ${table}.${filterCol}=${filterVal}`,
    );
    return null;
  }

  return { rows, name };
}
