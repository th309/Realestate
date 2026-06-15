// FILE-SIZE EXCEPTION (CLAUDE.md §1.3): one cohesive investment-metrics DB pipeline method; splitting it further risks behavior. See docs/superpowers/specs/2026-06-15-calculated-metrics-service-refactor-design.md.
import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
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
export class InvestmentMetricsCountiesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly mosInputs: RealtorMosInputsService,
  ) {}

  /**
   * Calculate and store investment metrics (cap_rate, gross_yield, rent_to_price, grm) for all counties
   */
  async calculateInvestmentMetricsForCounties(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates from zillow_county table matches
    const { data: zoriDates } = await this.supabase
      .from('zillow_county')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zoriDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Fetch MOS inputs once for the latest Realtor county period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const countyMosInputs =
      await this.mosInputs.fetchRealtorMosInputs('county');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestCountyMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all counties (paginated)
      const zoriData: any[] = [];
      let zoriOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('region_id, region_name, value, fips_code')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zoriOffset, zoriOffset + 1999);
        if (!page || page.length === 0) break;
        zoriData.push(...page);
        if (page.length < 2000) break;
        zoriOffset += 2000;
      }

      if (zoriData.length === 0) {
        // Skip dates with no data (common if ZORI is less frequent)
        continue;
      }

      // Get ZHVI data (property value) for all counties (paginated)
      const zhviData: any[] = [];
      let zhviOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('region_id, region_name, value, fips_code')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviOffset, zhviOffset + 1999);
        if (!page || page.length === 0) break;
        zhviData.push(...page);
        if (page.length < 2000) break;
        zhviOffset += 2000;
      }

      // Build price and name lookups by FIPS (5-digit normalized)
      const priceByCode: Record<string, number> = {};
      const nameByCode: Record<string, string> = {};
      const normalizeFips = (f: string | null | undefined) =>
        f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;
      if (zhviData) {
        for (const row of zhviData) {
          const fips = normalizeFips(row.fips_code);
          if (fips && row.value) {
            priceByCode[fips] = row.value;
            if (row.region_name) nameByCode[fips] = row.region_name;
          }
        }
      }

      const countyFipsWithZori = new Set(
        zoriData.map((c) => normalizeFips(c.fips_code)).filter(Boolean),
      );

      // Calculate and batch upsert (ZORI-based)
      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];
      const processedFipsThisDate = new Set<string>();

      for (const county of zoriData) {
        const fipsCode = normalizeFips(county.fips_code);
        if (!fipsCode || processedFipsThisDate.has(fipsCode)) continue;
        processedFipsThisDate.add(fipsCode);
        const zori = county.value;
        const price = priceByCode[fipsCode];

        if (!zori || !price) continue;

        const capRate = calculateCapRate(zori, price);
        const grossYield = calculateGrossYield(zori, price);
        const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
        const grm = calculateGRM(price, zori);

        const countyRec: any = {
          geography_id: fipsCode,
          geography_type: 'county',
          geography_name: county.region_name,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          calculated_at: new Date().toISOString(),
        };
        if (latestCountyMosDate != null && targetDate === latestCountyMosDate) {
          const m = countyMosInputs.get(String(fipsCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            countyRec.months_of_supply = mos;
            countyRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        recordsToUpsert.push(countyRec);

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

      // County fallback logic skipped inside loop for brevity unless critical?
      // The original code had HUD FMR fallback. I should include it.
      // But HUD FMR is annual. Doing it for EVERY month in history might be redundant/slow if data doesn't change.
      // However, if we filter by year, we can run it once per year if targetDate is relevant?
      // Or just include it. The original code ran it for the single Latest Date.
      // If I run history, I should ideally match HUD year to targetDate year.
      // Original code Logic: `const { data: latestYearRow } = ... limit(1)`.
      // I will adapt HUD logic to find FMR for `targetDate.getFullYear()`.

      const targetYear = parseInt(targetDate.substring(0, 4));

      const fipsWithZhviOnly = Object.keys(priceByCode).filter(
        (fips) => !countyFipsWithZori.has(fips),
      );

      if (fipsWithZhviOnly.length > 0) {
        // Fetch HUD for targetYear
        // Check if data exists for this year
        const { data: fmrRows } = await this.supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br, county_name')
          .eq('year', targetYear)
          .not('fmr_2br', 'is', null);

        if (fmrRows && fmrRows.length > 0) {
          const fmrByFips: Record<string, { rent: number; name?: string }> = {};
          for (const r of fmrRows) {
            const fips = normalizeFips(r.fips_code);
            if (fips && r.fmr_2br != null) {
              fmrByFips[fips] = {
                rent: r.fmr_2br,
                name: r.county_name ?? undefined,
              };
            }
          }

          const hudUpsert: any[] = [];
          for (const fips of fipsWithZhviOnly) {
            if (processedFipsThisDate.has(fips)) continue;
            const fmr = fmrByFips[fips];
            const price = priceByCode[fips];
            if (!fmr || !price || fmr.rent <= 0) continue;
            processedFipsThisDate.add(fips);

            const capRate = calculateCapRate(fmr.rent, price);
            const grossYield = calculateGrossYield(fmr.rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(fmr.rent, price);
            const grm = calculateGRM(price, fmr.rent);

            const hudCountyRec: any = {
              geography_id: fips,
              geography_type: 'county',
              geography_name: fmr.name || nameByCode[fips] || `County ${fips}`,
              period_date: targetDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            };
            if (
              latestCountyMosDate != null &&
              targetDate === latestCountyMosDate
            ) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                hudCountyRec.months_of_supply = mos;
                hudCountyRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            hudUpsert.push(hudCountyRec);
          }

          if (hudUpsert.length > 0) {
            // Batch HUD upsert if large? usually small subset?
            // Counties are ~3000. Just upsert all is fine or batch 1000.
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(hudUpsert, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) storedInBatch += hudUpsert.length;
          }
        }
      }

      totalProcessed += zoriData.length;
      totalStored += storedInBatch;
    }

    // ── REALTOR LISTING PRICE FALLBACK for counties without Zillow ZHVI ──
    // Counties that have Realtor median_listing_price + HUD FMR but no Zillow data
    // Use the latest ZORI date as the stored period_date so all data aligns for map queries
    const latestZoriTargetDate = uniqueDates.length > 0 ? uniqueDates[0] : null;
    try {
      // Get latest Realtor county data
      const { data: realtorLatest } = await this.supabase
        .from('realtor_county')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (realtorLatest?.period_date) {
        const realtorDate = realtorLatest.period_date;
        const realtorYear = parseInt(realtorDate.substring(0, 4));
        // Use ZORI date for storage to align with ZORI-based records on the map
        const storagePeriodDate = latestZoriTargetDate ?? realtorDate;

        // Get all Realtor county listing prices (paginated)
        const realtorCounties: any[] = [];
        let rcOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('realtor_county')
            .select('county_fips, county_name, median_listing_price')
            .eq('period_date', realtorDate)
            .not('median_listing_price', 'is', null)
            .not('county_fips', 'is', null)
            .range(rcOff, rcOff + 1999);
          if (!page || page.length === 0) break;
          realtorCounties.push(...page);
          if (page.length < 2000) break;
          rcOff += 2000;
        }

        if (realtorCounties.length > 0) {
          const normFips = (f: string | null | undefined) =>
            f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;

          // Find which FIPS already have calculated_metrics for the target date (paginated)
          const existingRows: any[] = [];
          let exOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('calculated_metrics')
              .select('geography_id')
              .eq('geography_type', 'county')
              .eq('period_date', storagePeriodDate)
              .not('cap_rate', 'is', null)
              .range(exOff, exOff + 1999);
            if (!page || page.length === 0) break;
            existingRows.push(...page);
            if (page.length < 2000) break;
            exOff += 2000;
          }

          const existingFips = new Set(existingRows.map((r) => r.geography_id));

          // Get HUD FMR for the Realtor year (paginated)
          const fmrRows: any[] = [];
          let fmrOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('hud_fmr')
              .select('fips_code, fmr_2br')
              .eq('year', realtorYear)
              .not('fmr_2br', 'is', null)
              .range(fmrOff, fmrOff + 1999);
            if (!page || page.length === 0) break;
            fmrRows.push(...page);
            if (page.length < 2000) break;
            fmrOff += 2000;
          }

          const fmrByFips: Record<string, number> = {};
          if (fmrRows.length > 0) {
            for (const r of fmrRows) {
              const fips = normFips(r.fips_code);
              if (fips && r.fmr_2br != null) fmrByFips[fips] = r.fmr_2br;
            }
          }

          // Also pull county ZORI as another rent option (might be fresher than HUD)
          const { data: latestZoriDate } = await this.supabase
            .from('zillow_county')
            .select('period_date')
            .eq('metric_name', 'zori')
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          const countyZoriByFips: Record<string, number> = {};
          if (latestZoriDate?.period_date) {
            // Paginated county ZORI fetch
            const zoriRows: any[] = [];
            let zrOff = 0;
            while (true) {
              const { data: page } = await this.supabase
                .from('zillow_county')
                .select('fips_code, value')
                .eq('metric_name', 'zori')
                .eq('period_date', latestZoriDate.period_date)
                .not('value', 'is', null)
                .range(zrOff, zrOff + 1999);
              if (!page || page.length === 0) break;
              zoriRows.push(...page);
              if (page.length < 2000) break;
              zrOff += 2000;
            }

            if (zoriRows.length > 0) {
              for (const r of zoriRows) {
                const fips = normFips(r.fips_code);
                if (fips && r.value) countyZoriByFips[fips] = r.value;
              }
            }
          }

          let realtorUpsert: any[] = [];
          let realtorCount = 0;
          const processedRealtorFips = new Set<string>();

          for (const county of realtorCounties) {
            const fips = normFips(county.county_fips);
            if (
              !fips ||
              existingFips.has(fips) ||
              processedRealtorFips.has(fips)
            )
              continue;
            processedRealtorFips.add(fips);

            const price = county.median_listing_price;
            if (!price || price <= 0) continue;

            // Use ZORI if available, otherwise HUD FMR
            const rent = countyZoriByFips[fips] ?? fmrByFips[fips];
            if (!rent || rent <= 0) continue;

            const capRate = calculateCapRate(rent, price);
            const grossYield = calculateGrossYield(rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(rent, price);
            const grm = calculateGRM(price, rent);

            const realtorCountyRec: any = {
              geography_id: fips,
              geography_type: 'county',
              geography_name: county.county_name || `County ${fips}`,
              period_date: storagePeriodDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            };
            if (
              latestCountyMosDate != null &&
              storagePeriodDate === latestCountyMosDate
            ) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorCountyRec.months_of_supply = mos;
                realtorCountyRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            realtorUpsert.push(realtorCountyRec);

            if (realtorUpsert.length >= 500) {
              const { error } = await this.supabase
                .from('calculated_metrics')
                .upsert(realtorUpsert, {
                  onConflict: 'geography_id,geography_type,period_date',
                });
              if (!error) realtorCount += realtorUpsert.length;
              else errors.push(`Realtor county fallback: ${error.message}`);
              realtorUpsert = [];
            }
          }

          if (realtorUpsert.length > 0) {
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(realtorUpsert, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) realtorCount += realtorUpsert.length;
            else errors.push(`Realtor county fallback: ${error.message}`);
          }

          if (realtorCount > 0) {
            totalStored += realtorCount;
            console.log(
              `[CalculatedMetrics] Realtor county fallback: ${realtorCount} counties added`,
            );
          }
        }
      }
    } catch (e: any) {
      errors.push(`Realtor county fallback error: ${e.message}`);
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }
}
