import { SupabaseClient } from '@supabase/supabase-js';
import { CalculatedMetricsService } from './calculated-metrics.service';

/**
 * On-the-fly cap-rate compute for metros. Extracted verbatim from the original
 * MetricsController.getMetroCapRate body. Tries pre-calculated data first, then
 * computes from ZORI/ZHVI with a population-weighted HUD-FMR fallback for metros
 * that have ZHVI but no ZORI.
 * Calculated as: (ZORI * 12 * 0.6) / ZHVI * 100
 */
export async function computeMetroCapRate(
  supabase: SupabaseClient,
  calculatedMetricsService: CalculatedMetricsService,
  date?: string,
) {
  // Try pre-calculated data first
  const preCalculated =
    await calculatedMetricsService.getInvestmentMetricsForMap(
      'cap_rate',
      'metro',
    );
  if (preCalculated.success && preCalculated.data.length > 0) {
    return {
      success: true,
      count: preCalculated.data.length,
      geography: 'Metro',
      metric: 'cap_rate',
      source: 'pre-calculated',
      data: preCalculated.data,
    };
  }

  // Fallback to on-the-fly calculation
  // Get latest date from ZORI data
  let targetDate = date;
  if (!targetDate) {
    const { data: latestDate } = await supabase
      .from('zillow_zori')
      .select('date')
      .eq('geography', 'Metro')
      .order('date', { ascending: false })
      .limit(1)
      .single();
    targetDate = latestDate?.date;
  }

  if (!targetDate) {
    return { success: false, error: 'No ZORI data available', data: [] };
  }

  // Get ZORI (rent) data
  const { data: zoriData, error: zoriError } = await supabase
    .from('zillow_zori')
    .select('region_id, region_name, value, cbsa_code')
    .eq('geography', 'Metro')
    .eq('date', targetDate)
    .not('value', 'is', null);

  if (zoriError || !zoriData) {
    return {
      success: false,
      error: zoriError?.message || 'Failed to fetch ZORI data',
      data: [],
    };
  }

  // Get ZHVI data for the same metros
  const { data: zhviData } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value')
    .eq('geography', 'Metro')
    .eq('date', targetDate)
    .not('value', 'is', null);

  // Create ZHVI lookup
  const zhviByRegion: Record<string, number> = {};
  if (zhviData) {
    for (const row of zhviData) {
      zhviByRegion[row.region_id] = row.value;
    }
  }

  // Calculate cap rate for each metro
  const EXPENSE_RATIO = 0.6; // NOI ratio
  const zoriCbsas = new Set<string>();
  const results = zoriData
    .filter((metro) => zhviByRegion[metro.region_id])
    .map((metro) => {
      const zori = metro.value;
      const zhvi = zhviByRegion[metro.region_id];
      const capRate = ((zori * 12 * EXPENSE_RATIO) / zhvi) * 100;
      if (metro.cbsa_code) zoriCbsas.add(metro.cbsa_code);

      return {
        region_id: metro.region_id,
        region_name: metro.region_name,
        cbsa_code: metro.cbsa_code,
        zori,
        zhvi,
        cap_rate: Math.round(capRate * 100) / 100,
      };
    });

  // ── HUD FMR fallback for metros with ZHVI but no ZORI ──
  // Get ZHVI metros from long-format table to find CBSAs without ZORI
  const { data: zhviMetroRows } = await supabase
    .from('zillow_metro')
    .select('cbsa_code, value, region_name')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null)
    .not('cbsa_code', 'is', null);

  if (zhviMetroRows && zhviMetroRows.length > 0) {
    const cbsasWithZhviOnly = zhviMetroRows.filter(
      (r) => r.cbsa_code && !zoriCbsas.has(r.cbsa_code),
    );

    if (cbsasWithZhviOnly.length > 0) {
      const cbsaCodes = cbsasWithZhviOnly.map((r) => r.cbsa_code!);
      const targetYear = parseInt(targetDate.substring(0, 4));

      // Map CBSA → ZHVI price & name
      const priceByCode: Record<string, number> = {};
      const nameByCode: Record<string, string> = {};
      for (const row of cbsasWithZhviOnly) {
        priceByCode[row.cbsa_code!] = row.value;
        nameByCode[row.cbsa_code!] =
          row.region_name || `Metro ${row.cbsa_code}`;
      }

      // Get component counties
      const { data: countyRows } = await supabase
        .from('geographies')
        .select('cbsa_code, fips_code, population')
        .eq('geography_type', 'county')
        .in('cbsa_code', cbsaCodes)
        .not('fips_code', 'is', null);

      if (countyRows && countyRows.length > 0) {
        // Group counties by CBSA
        const countiesByCbsa: Record<
          string,
          Array<{ fips: string; population: number | null }>
        > = {};
        for (const c of countyRows) {
          if (!c.cbsa_code || !c.fips_code) continue;
          if (!countiesByCbsa[c.cbsa_code]) countiesByCbsa[c.cbsa_code] = [];
          countiesByCbsa[c.cbsa_code].push({
            fips: String(parseInt(c.fips_code, 10)).padStart(5, '0'),
            population: c.population,
          });
        }

        // Fetch HUD FMR
        const allFips = countyRows
          .map((c) =>
            c.fips_code
              ? String(parseInt(c.fips_code, 10)).padStart(5, '0')
              : null,
          )
          .filter(Boolean) as string[];

        const { data: fmrRows } = await supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br')
          .eq('year', targetYear)
          .in('fips_code', allFips)
          .not('fmr_2br', 'is', null);

        if (fmrRows && fmrRows.length > 0) {
          const fmrByFips: Record<string, number> = {};
          for (const r of fmrRows) {
            const fips =
              r.fips_code && /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
            if (fips && r.fmr_2br != null) fmrByFips[fips] = r.fmr_2br;
          }

          // Compute population-weighted FMR for each metro
          for (const cbsa of cbsaCodes) {
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
            const avgRent = totalRent / totalWeight;
            const price = priceByCode[cbsa];
            if (!price) continue;

            const capRate = ((avgRent * 12 * EXPENSE_RATIO) / price) * 100;
            results.push({
              region_id: cbsa,
              region_name: nameByCode[cbsa] || `Metro ${cbsa}`,
              cbsa_code: cbsa,
              zori: avgRent,
              zhvi: price,
              cap_rate: Math.round(capRate * 100) / 100,
            });
          }
        }
      }
    }
  }

  return {
    success: true,
    count: results.length,
    geography: 'Metro',
    metric: 'cap_rate',
    data: results,
  };
}
