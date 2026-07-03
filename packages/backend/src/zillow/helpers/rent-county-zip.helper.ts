/**
 * ZORI Rent Helpers (county + ZIP, state-scoped)
 *
 * County rent and ZIP rent fetchers (both with HUD FMR fallback), extracted
 * from zillow.service.ts for file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeStateToCode,
  STATE_CODE_TO_FIPS,
  STATE_FIPS_TO_CODE,
} from '../../common/geo';
import type { HomeValueData } from '../types';
import { getLatestDate, mapRentPropertyType, queryZori } from './queries';
import { buildZipMappings } from './crosswalk';

export async function getCountyRent(
  supabase: SupabaseClient,
  date?: string,
  propertyType: string = 'all',
  stateFilter?: string,
): Promise<HomeValueData[]> {
  stateFilter = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  const metricName = mapRentPropertyType(propertyType);
  const targetDate =
    date || (await getLatestDate(supabase, 'county', metricName));

  // Query zillow_county table directly (same pattern as getCountyHomeValues)
  // The previous approach incorrectly used FIPS codes as region_ids
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let query = supabase
      .from('zillow_county')
      .select(
        'region_id, region_name, state_code, fips_code, value, period_date',
      )
      .eq('metric_name', metricName);

    if (targetDate) {
      query = query.eq('period_date', targetDate);
    }

    if (stateFilter) {
      query = query.eq('state_code', stateFilter.toUpperCase());
    }

    const { data: pageData, error } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    if (error) {
      throw new Error(`Error fetching county rent data: ${error.message}`);
    }

    if (!pageData || pageData.length === 0) break;

    allData.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  // Map ZORI results
  const results: HomeValueData[] = allData
    .filter((record) => record.fips_code)
    .map((record) => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      county_fips: record.fips_code,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: propertyType === 'all' ? 'sfrcondomfr' : propertyType,
      geography: 'County',
    }));

  // ── HUD FMR fallback: fill counties without ZORI data ──
  try {
    const existingFips = new Set(
      results.map((r) => r.county_fips).filter(Boolean),
    );
    const year = targetDate
      ? parseInt(targetDate.substring(0, 4))
      : new Date().getFullYear();
    const fmrDate = targetDate || `${year}-01-01`;

    // Paginate HUD FMR to get all counties (Supabase default limit is 1000)
    let fmrOffset = 0;
    const fmrPageSize = 2000;
    while (true) {
      let fmrQuery = supabase
        .from('hud_fmr')
        .select('fips_code, county_name, state_fips, fmr_2br')
        .eq('year', year)
        .not('fmr_2br', 'is', null)
        .range(fmrOffset, fmrOffset + fmrPageSize - 1);

      if (stateFilter) {
        const stateFips = STATE_CODE_TO_FIPS[stateFilter.toUpperCase()];
        if (stateFips) {
          fmrQuery = fmrQuery.eq('state_fips', stateFips);
        }
      }

      const { data: fmrRows } = await fmrQuery;
      if (!fmrRows || fmrRows.length === 0) break;

      for (const fmr of fmrRows) {
        const fips =
          fmr.fips_code && /^\d+$/.test(fmr.fips_code)
            ? String(parseInt(fmr.fips_code, 10)).padStart(5, '0')
            : fmr.fips_code;
        if (!fips || existingFips.has(fips)) continue;
        existingFips.add(fips);

        const stateAbbrev =
          stateFilter || STATE_FIPS_TO_CODE[fmr.state_fips] || null;
        results.push({
          region_id: fips,
          region_name: fmr.county_name || `County ${fips}`,
          county_fips: fips,
          state_abbrev: stateAbbrev,
          state_name: null,
          value: Number(fmr.fmr_2br),
          date: fmrDate,
          property_type: propertyType === 'all' ? 'sfrcondomfr' : propertyType,
          geography: 'County',
        });
      }

      if (fmrRows.length < fmrPageSize) break;
      fmrOffset += fmrPageSize;
    }
  } catch (e) {
    console.error('[ZillowService] HUD FMR county rent fallback error:', e);
  }

  return results.sort((a, b) => b.value - a.value);
}

export async function getZipRent(
  supabase: SupabaseClient,
  stateFilter: string,
  propertyType: string = 'all',
  date?: string,
): Promise<HomeValueData[]> {
  stateFilter = normalizeStateToCode(stateFilter);
  const metricName = mapRentPropertyType(propertyType);
  // OPTIMIZATION: Run date lookup and ZIP mappings in parallel
  const [targetDate, zipMap] = await Promise.all([
    date ? Promise.resolve(date) : getLatestDate(supabase, 'zip', metricName),
    buildZipMappings(supabase, stateFilter),
  ]);

  const zipCodes = [...zipMap.keys()];
  if (zipCodes.length === 0) return [];

  // Pass propertyType directly - queryZori handles mapping to metric name
  const zillow = await queryZori(
    supabase,
    'Zip',
    targetDate,
    propertyType,
    zipCodes,
  );

  const results = zillow.map((z) => {
    const zip = zipMap.get(z.region_id);
    return {
      region_id: z.region_id,
      region_name: zip ? `${z.region_id} - ${zip.city}` : z.region_id,
      zip_code: z.region_id,
      city: zip?.city || null,
      county_name: zip?.county || null,
      state_abbrev: zip?.state_abbrev || null,
      state_name: zip?.state_name || null,
      value: z.value,
      date: z.date,
      property_type: z.property_type,
      geography: 'ZIP',
    };
  });

  // ── HUD FMR fallback: fill zips without ZORI data ──
  try {
    const zoriZips = new Set(results.map((r) => r.region_id));
    const missingZips = zipCodes.filter((z) => !zoriZips.has(z));

    if (missingZips.length > 0) {
      // Get zip-to-county-fips mapping (batch in chunks of 2000 for Supabase .in() limit)
      const zipToFips: Record<string, string> = {};
      for (let i = 0; i < missingZips.length; i += 2000) {
        const chunk = missingZips.slice(i, i + 2000);
        const { data: geoRows } = await supabase
          .from('geographies')
          .select('geography_id, fips_code')
          .eq('geography_type', 'zip')
          .in('geography_id', chunk)
          .not('fips_code', 'is', null);

        if (geoRows) {
          for (const r of geoRows) {
            if (r.fips_code) {
              zipToFips[r.geography_id] = /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
            }
          }
        }
      }

      if (Object.keys(zipToFips).length > 0) {
        const year = targetDate
          ? parseInt(targetDate.substring(0, 4))
          : new Date().getFullYear();
        const uniqueFips = [...new Set(Object.values(zipToFips))];

        // Fetch HUD FMR (batch in chunks)
        const fmrByFips: Record<string, number> = {};
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
              const fips = /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
              if (fips) fmrByFips[fips] = r.fmr_2br;
            }
          }
        }

        for (const zipCode of missingZips) {
          const countyFips = zipToFips[zipCode];
          if (!countyFips) continue;
          const rent = fmrByFips[countyFips];
          if (!rent) continue;

          const zip = zipMap.get(zipCode);
          results.push({
            region_id: zipCode,
            region_name: zip ? `${zipCode} - ${zip.city}` : zipCode,
            zip_code: zipCode,
            city: zip?.city || null,
            county_name: zip?.county || null,
            state_abbrev: zip?.state_abbrev || stateFilter,
            state_name: zip?.state_name || null,
            value: Number(rent),
            date: targetDate || `${year}-01-01`,
            property_type:
              propertyType === 'all' ? 'sfrcondomfr' : propertyType,
            geography: 'ZIP',
          });
        }
      }
    }
  } catch (e) {
    console.error('[ZillowService] HUD FMR zip rent fallback error:', e);
  }

  return results.sort((a, b) => b.value - a.value);
}
