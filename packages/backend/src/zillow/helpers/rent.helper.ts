/**
 * ZORI Rent Helpers (metro + all-ZIP)
 *
 * Metro rent (with HUD FMR fallback) and the unfiltered all-ZIP rent fetcher,
 * extracted from zillow.service.ts for file-size compliance — behavior
 * unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { HomeValueData } from '../types';
import { getLatestDate, mapRentPropertyType, queryZori } from './queries';
import { buildMetroMappings, lookupMetro } from './crosswalk';

export async function getMetroRent(
  supabase: SupabaseClient,
  date?: string,
  propertyType: string = 'all',
): Promise<HomeValueData[]> {
  const metricName = mapRentPropertyType(propertyType);
  const targetDate =
    date || (await getLatestDate(supabase, 'metro', metricName));

  // Pass propertyType directly - queryZori handles mapping to metric name
  const zillow = await queryZori(
    supabase,
    ['Metro', 'US'],
    targetDate,
    propertyType,
  );

  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);

  const results: HomeValueData[] = zillow.map((z) => {
    if (z.geography === 'US') {
      return {
        region_id: z.region_id,
        region_name: 'United States',
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: 'US',
      };
    }

    const { metro, cbsaCode } = lookupMetro(
      z.region_id,
      byZillowId,
      byCbsaCode,
    );

    return {
      region_id: z.region_id,
      region_name: metro?.cbsa_name || 'Unknown',
      cbsa_code: cbsaCode,
      state_abbrev: metro?.state || null,
      value: z.value,
      date: z.date,
      property_type: z.property_type,
      geography: 'Metro',
    };
  });

  // ── HUD FMR fallback: fill metros without ZORI data ──
  // Compute population-weighted average of county FMR values for each metro
  try {
    const existingCbsa = new Set(
      results.map((r) => r.cbsa_code).filter(Boolean),
    );
    const year = targetDate
      ? parseInt(targetDate.substring(0, 4))
      : new Date().getFullYear();
    const fmrDate = targetDate || `${year}-01-01`;

    // Get all metros from the crosswalk that don't have ZORI data
    const allCbsaCodes = [...byCbsaCode.keys()];
    const missingCbsa = allCbsaCodes.filter((c) => !existingCbsa.has(c));

    if (missingCbsa.length > 0) {
      // Get component counties with population for missing metros
      const countiesByCbsa: Record<
        string,
        Array<{ fips: string; population: number | null }>
      > = {};
      const allFips: string[] = [];

      // Batch fetch counties (Supabase .in() limit)
      for (let i = 0; i < missingCbsa.length; i += 2000) {
        const chunk = missingCbsa.slice(i, i + 2000);
        const { data: countyRows } = await supabase
          .from('geographies')
          .select('cbsa_code, fips_code, population')
          .eq('geography_type', 'county')
          .in('cbsa_code', chunk)
          .not('fips_code', 'is', null);

        if (countyRows) {
          for (const c of countyRows) {
            if (!c.cbsa_code || !c.fips_code) continue;
            if (!countiesByCbsa[c.cbsa_code]) countiesByCbsa[c.cbsa_code] = [];
            const fips = String(parseInt(c.fips_code, 10)).padStart(5, '0');
            countiesByCbsa[c.cbsa_code].push({
              fips,
              population: c.population,
            });
            allFips.push(fips);
          }
        }
      }

      if (allFips.length > 0) {
        // Fetch HUD FMR for all component counties
        const fmrByFips: Record<string, number> = {};
        const uniqueFips = [...new Set(allFips)];
        for (let i = 0; i < uniqueFips.length; i += 2000) {
          const chunk = uniqueFips.slice(i, i + 2000);
          const { data: fmrRows } = await supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', year)
            .in('fips_code', chunk)
            .not('fmr_2br', 'is', null);

          if (fmrRows) {
            for (const r of fmrRows) {
              const fips =
                r.fips_code && /^\d+$/.test(r.fips_code)
                  ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                  : r.fips_code;
              if (fips && r.fmr_2br != null) fmrByFips[fips] = r.fmr_2br;
            }
          }
        }

        // Compute population-weighted FMR for each metro
        for (const cbsa of missingCbsa) {
          const counties = countiesByCbsa[cbsa];
          if (!counties || counties.length === 0) continue;

          let totalRent = 0;
          let totalWeight = 0;
          for (const county of counties) {
            const fmr = fmrByFips[county.fips];
            if (fmr == null || fmr <= 0) continue;
            const weight = county.population ?? 1;
            totalRent += fmr * weight;
            totalWeight += weight;
          }

          if (totalWeight === 0) continue;
          const avgRent = Math.round(totalRent / totalWeight);

          const metro = byCbsaCode.get(cbsa);
          results.push({
            region_id: cbsa,
            region_name: metro?.cbsa_name || `Metro ${cbsa}`,
            cbsa_code: cbsa,
            state_abbrev: metro?.state || null,
            value: avgRent,
            date: fmrDate,
            property_type:
              propertyType === 'all' ? 'sfrcondomfr' : propertyType,
            geography: 'Metro',
          });
        }
      }
    }
  } catch (e) {
    console.error('[ZillowService] HUD FMR metro rent fallback error:', e);
  }

  return results.sort((a, b) => b.value - a.value);
}

/**
 * Get all ZIP rent data without state filter (with limit for performance)
 */
export async function getAllZipRent(
  supabase: SupabaseClient,
  date?: string,
  propertyType: string = 'all',
  limit: number = 100,
): Promise<HomeValueData[]> {
  try {
    const metricName = mapRentPropertyType(propertyType);
    const targetDate =
      date || (await getLatestDate(supabase, 'zip', metricName));

    console.log(
      `getAllZipRent: targetDate=${targetDate}, metric=${metricName}, limit=${limit}`,
    );

    // Query all ZIPs with a limit, ordered by value descending
    const { data: zipData, error } = await supabase
      .from('zillow_zip')
      .select('region_id, region_name, state_code, value, period_date')
      .eq('metric_name', metricName)
      .eq('period_date', targetDate)
      .order('value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`getAllZipRent error: ${error.message}`);
      return [];
    }

    if (!zipData || zipData.length === 0) return [];

    // Map results
    return zipData.map((record) => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      zip_code: record.region_name,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: propertyType,
      geography: 'ZIP',
    }));
  } catch (err) {
    console.error(`getAllZipRent unexpected error:`, err);
    return [];
  }
}
