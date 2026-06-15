// FILE-SIZE EXCEPTION (CLAUDE.md §1.3): one cohesive investment-metrics DB pipeline method; splitting it further risks behavior. See docs/superpowers/specs/2026-06-15-calculated-metrics-service-refactor-design.md.
import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateCAGR } from '../../common/zip';
import { RealtorMosInputsService } from './realtor-mos-inputs.service';
import {
  calculateCapRate,
  calculateGrossYield,
  calculateRentToPriceRatio,
  calculateGRM,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
} from '../metric-formulas';

@Injectable()
export class InvestmentMetricsMetrosService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly mosInputs: RealtorMosInputsService,
  ) {}

  /**
   * Calculate and store investment metrics (cap_rate, gross_yield, rent_to_price, grm) for all metros
   * Combines Zillow ZORI data with Realtor median_listing_price
   */
  async calculateInvestmentMetricsForMetros(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates (descending)
    const { data: zoriDates } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zoriDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      console.log(
        `[CalculatedMetrics] Filtering investment metrics (metros) for year: ${year}`,
      );
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Fetch MOS inputs once for the latest Realtor metro period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const metroMosInputs = await this.mosInputs.fetchRealtorMosInputs('metro');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all metros from zillow_metro table
      // Paginated ZORI fetch for metros
      const zoriData: any[] = [];
      let zoriOff = 0;
      while (true) {
        const { data: page, error: zoriError } = await this.supabase
          .from('zillow_metro')
          .select('region_id, region_name, value, cbsa_code')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zoriOff, zoriOff + 1999);
        if (zoriError) {
          errors.push(`${targetDate}: ${zoriError.message}`);
          break;
        }
        if (!page || page.length === 0) break;
        zoriData.push(...page);
        if (page.length < 2000) break;
        zoriOff += 2000;
      }

      if (zoriData.length === 0) {
        continue;
      }

      // Get ZHVI (value) data for all metros (paginated)
      const zhviDataAll: any[] = [];
      let zhviOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_metro')
          .select('region_id, value, cbsa_code, region_name')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviOff, zhviOff + 1999);
        if (!page || page.length === 0) break;
        zhviDataAll.push(...page);
        if (page.length < 2000) break;
        zhviOff += 2000;
      }

      // Fallback if exact date match fails (ZHVI might be updated at different cadence)
      const zhviRows: Array<{
        region_id: number;
        value: number;
        cbsa_code: string | null;
        region_name: string | null;
      }> = zhviDataAll;
      if (zhviRows.length === 0) {
        const { data: zhviDateRow } = await this.supabase
          .from('zillow_metro')
          .select('period_date')
          .eq('metric_name', 'zhvi')
          .lte('period_date', targetDate)
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (zhviDateRow?.period_date) {
          let fbOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('zillow_metro')
              .select('region_id, value, cbsa_code, region_name')
              .eq('metric_name', 'zhvi')
              .eq('period_date', zhviDateRow.period_date)
              .not('value', 'is', null)
              .range(fbOff, fbOff + 1999);
            if (!page || page.length === 0) break;
            zhviRows.push(...page);
            if (page.length < 2000) break;
            fbOff += 2000;
          }
        }
      }

      // Build price lookup by CBSA code (from matched or fallback ZHVI date)
      const priceByCode: Record<string, number> = {};
      for (const row of zhviRows) {
        if (row.cbsa_code && row.value) {
          priceByCode[row.cbsa_code] = row.value;
        }
      }

      // ── Fetch ZORI history for YoY and 5yr CAGR ──
      const oneYearAgo = new Date(targetDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      const oneYearAgoMax = new Date(
        oneYearAgo.getTime() + 60 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      const fiveYearsAgo = new Date(targetDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];
      const fiveYearsAgoMax = new Date(
        fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // ZORI 1 year ago (for YoY)
      const zoriPast1yr: Record<string, number> = {};
      const { data: zori1yrData } = await this.supabase
        .from('zillow_metro')
        .select('cbsa_code, value')
        .eq('metric_name', 'zori')
        .gte('period_date', oneYearAgoStr)
        .lte('period_date', oneYearAgoMax)
        .not('value', 'is', null)
        .order('period_date', { ascending: false });
      if (zori1yrData) {
        for (const r of zori1yrData) {
          if (r.cbsa_code && !zoriPast1yr[r.cbsa_code])
            zoriPast1yr[r.cbsa_code] = r.value;
        }
      }

      // ZORI 5 years ago (for 5yr CAGR)
      const zoriPast5yr: Record<string, number> = {};
      const { data: zori5yrData } = await this.supabase
        .from('zillow_metro')
        .select('cbsa_code, value')
        .eq('metric_name', 'zori')
        .gte('period_date', fiveYearsAgoStr)
        .lte('period_date', fiveYearsAgoMax)
        .not('value', 'is', null)
        .order('period_date', { ascending: false });
      if (zori5yrData) {
        for (const r of zori5yrData) {
          if (r.cbsa_code && !zoriPast5yr[r.cbsa_code])
            zoriPast5yr[r.cbsa_code] = r.value;
        }
      }

      // Calculate and batch upsert
      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];

      for (const metro of zoriData) {
        const cbsaCode = metro.cbsa_code;
        const zori = metro.value;
        const price = cbsaCode ? priceByCode[cbsaCode] : null;

        if (!zori || !price) continue;

        const capRate = calculateCapRate(zori, price);
        const grossYield = calculateGrossYield(zori, price);
        const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
        const grm = calculateGRM(price, zori);

        // Rent growth metrics
        const pastRent1yr = cbsaCode ? zoriPast1yr[cbsaCode] : null;
        const zoriYoy =
          pastRent1yr && pastRent1yr > 0
            ? Math.round(((zori - pastRent1yr) / pastRent1yr) * 10000) / 100
            : null;

        const pastRent5yr = cbsaCode ? zoriPast5yr[cbsaCode] : null;
        const zori5yCagr =
          pastRent5yr && pastRent5yr > 0
            ? Math.round(calculateCAGR(pastRent5yr, zori, 5)! * 100) / 100
            : null;

        const metroRec: any = {
          geography_id: cbsaCode,
          geography_type: 'metro',
          geography_name: metro.region_name,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          zori_yoy: zoriYoy,
          zori_5y_cagr: zori5yCagr,
          calculated_at: new Date().toISOString(),
        };
        if (latestMosDate != null && targetDate === latestMosDate) {
          const m = metroMosInputs.get(String(cbsaCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            metroRec.months_of_supply = mos;
            metroRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        recordsToUpsert.push(metroRec);

        if (recordsToUpsert.length >= batchSize) {
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(recordsToUpsert, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (error) {
            errors.push(`${targetDate}: ${error.message}`);
          } else {
            storedInBatch += recordsToUpsert.length;
          }
          recordsToUpsert = [];
        }
      }

      // Upsert remaining
      if (recordsToUpsert.length > 0) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (error) {
          errors.push(`${targetDate}: ${error.message}`);
        } else {
          storedInBatch += recordsToUpsert.length;
        }
      }

      totalProcessed += zoriData.length;
      totalStored += storedInBatch;

      // ── HUD FMR FALLBACK for metros without ZORI ──
      // Identify CBSA codes that have ZHVI but were not covered by ZORI
      const zoriCbsas = new Set(
        zoriData.map((m) => m.cbsa_code).filter(Boolean),
      );
      const cbsasWithZhviOnly = Object.keys(priceByCode).filter(
        (cbsa) => !zoriCbsas.has(cbsa),
      );

      if (cbsasWithZhviOnly.length > 0) {
        const targetYear = parseInt(targetDate.substring(0, 4));

        // Get ZHVI metro names for these CBSAs
        const nameByCode: Record<string, string> = {};
        for (const row of zhviRows) {
          if (row.cbsa_code && row.region_name) {
            nameByCode[row.cbsa_code] = row.region_name;
          }
        }

        // Look up component counties for these metros (paginated)
        const countyRows: any[] = [];
        let cOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('geographies')
            .select('cbsa_code, fips_code, population')
            .eq('geography_type', 'county')
            .in('cbsa_code', cbsasWithZhviOnly)
            .not('fips_code', 'is', null)
            .range(cOff, cOff + 1999);
          if (!page || page.length === 0) break;
          countyRows.push(...page);
          if (page.length < 2000) break;
          cOff += 2000;
        }

        if (countyRows.length > 0) {
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

          // Fetch HUD FMR for the target year, previous year (YoY), and 5 years ago (CAGR)
          const allFips = countyRows
            .map((c) =>
              c.fips_code
                ? String(parseInt(c.fips_code, 10)).padStart(5, '0')
                : null,
            )
            .filter(Boolean) as string[];

          const fmrYears = [targetYear, targetYear - 1, targetYear - 5];
          const fmrByYearAndFips: Record<number, Record<string, number>> = {};

          for (const fmrYear of fmrYears) {
            fmrByYearAndFips[fmrYear] = {};
            let fmrOff = 0;
            while (true) {
              const { data: page } = await this.supabase
                .from('hud_fmr')
                .select('fips_code, fmr_2br')
                .eq('year', fmrYear)
                .in('fips_code', allFips)
                .not('fmr_2br', 'is', null)
                .range(fmrOff, fmrOff + 1999);
              if (!page || page.length === 0) break;
              for (const r of page) {
                const fips =
                  r.fips_code && /^\d+$/.test(r.fips_code)
                    ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                    : r.fips_code;
                if (fips && r.fmr_2br != null) {
                  fmrByYearAndFips[fmrYear][fips] = r.fmr_2br;
                }
              }
              if (page.length < 2000) break;
              fmrOff += 2000;
            }
          }

          const fmrByFips = fmrByYearAndFips[targetYear];

          if (Object.keys(fmrByFips).length > 0) {
            // Helper: compute population-weighted average FMR for a metro from county FMR data
            const computeWeightedFmr = (
              cbsa: string,
              fmrLookup: Record<string, number>,
            ): number | null => {
              const counties = countiesByCbsa[cbsa];
              if (!counties || counties.length === 0) return null;
              let totalRent = 0;
              let totalWeight = 0;
              for (const county of counties) {
                const fmr = fmrLookup[county.fips];
                if (fmr == null || fmr <= 0) continue;
                const weight = county.population ?? 1;
                totalRent += fmr * weight;
                totalWeight += weight;
              }
              return totalWeight > 0 ? totalRent / totalWeight : null;
            };

            // For each metro without ZORI, compute investment metrics + rent growth proxies
            const hudMetroUpsert: any[] = [];
            for (const cbsa of cbsasWithZhviOnly) {
              const avgRent = computeWeightedFmr(cbsa, fmrByFips);
              if (!avgRent) continue;

              const price = priceByCode[cbsa];
              if (!price) continue;

              const capRate = calculateCapRate(avgRent, price);
              const grossYield = calculateGrossYield(avgRent, price);
              const rentToPriceRatio = calculateRentToPriceRatio(
                avgRent,
                price,
              );
              const grm = calculateGRM(price, avgRent);

              // HUD FMR rent growth proxies
              const avgRentPrevYear = computeWeightedFmr(
                cbsa,
                fmrByYearAndFips[targetYear - 1],
              );
              const hudZoriYoy =
                avgRentPrevYear && avgRentPrevYear > 0
                  ? Math.round(
                      ((avgRent - avgRentPrevYear) / avgRentPrevYear) * 10000,
                    ) / 100
                  : null;

              const avgRent5yrAgo = computeWeightedFmr(
                cbsa,
                fmrByYearAndFips[targetYear - 5],
              );
              const hudZori5yCagr =
                avgRent5yrAgo && avgRent5yrAgo > 0
                  ? Math.round(
                      calculateCAGR(avgRent5yrAgo, avgRent, 5)! * 100,
                    ) / 100
                  : null;

              const hudMetroRec: any = {
                geography_id: cbsa,
                geography_type: 'metro',
                geography_name: nameByCode[cbsa] || `Metro ${cbsa}`,
                period_date: targetDate,
                cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
                gross_yield: grossYield
                  ? Math.round(grossYield * 100) / 100
                  : null,
                rent_to_price_ratio: rentToPriceRatio
                  ? Math.round(rentToPriceRatio * 10000) / 10000
                  : null,
                grm: grm ? Math.round(grm * 100) / 100 : null,
                zori_yoy: hudZoriYoy,
                zori_5y_cagr: hudZori5yCagr,
                calculated_at: new Date().toISOString(),
              };
              if (latestMosDate != null && targetDate === latestMosDate) {
                const m = metroMosInputs.get(String(cbsa));
                const mos = m
                  ? calculateMonthsOfSupply(m.active, m.pending)
                  : null;
                if (m && mos != null) {
                  hudMetroRec.months_of_supply = mos;
                  hudMetroRec.absorption_rate = calculateAbsorptionRate(
                    m.pending,
                    m.active,
                  );
                }
              }
              hudMetroUpsert.push(hudMetroRec);
            }

            if (hudMetroUpsert.length > 0) {
              const { error } = await this.supabase
                .from('calculated_metrics')
                .upsert(hudMetroUpsert, {
                  onConflict: 'geography_id,geography_type,period_date',
                });
              if (error) {
                errors.push(
                  `${targetDate} HUD metro fallback: ${error.message}`,
                );
              } else {
                totalStored += hudMetroUpsert.length;
              }
              console.log(
                `[CalculatedMetrics] HUD FMR metro fallback: ${hudMetroUpsert.length} metros for ${targetDate}`,
              );
            }
          }
        }
      }
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }
}
