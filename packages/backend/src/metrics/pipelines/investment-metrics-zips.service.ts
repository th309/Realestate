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
export class InvestmentMetricsZipsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly mosInputs: RealtorMosInputsService,
  ) {}

  /**
   * Calculate and store investment metrics for all ZIP codes
   */
  async calculateInvestmentMetricsForZips(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates from zillow_metro table as proxy
    const { data: zoriDates } = await this.supabase
      .from('zillow_metro')
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

    // Fetch MOS inputs once for the latest Realtor zip period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const zipMosInputs = await this.mosInputs.fetchRealtorMosInputs('zip');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestZipMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZHVI data for all zips (paginated)
      const zhviData: any[] = [];
      let zhviZipOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_zip')
          .select('region_name, value, county_fips')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviZipOff, zhviZipOff + 4999);
        if (!page || page.length === 0) break;
        zhviData.push(...page);
        if (page.length < 5000) break;
        zhviZipOff += 5000;
      }

      if (zhviData.length === 0) {
        continue;
      }

      const priceByZip: Record<string, number> = {};
      const zipToCounty: Record<string, string> = {};
      const normalizeFipsZip = (f: string | null | undefined) =>
        f && /^\d+$/.test(f)
          ? String(parseInt(f, 10)).padStart(5, '0')
          : (f ?? null);

      for (const row of zhviData) {
        priceByZip[row.region_name] = row.value;
        if (row.county_fips) {
          const fips = normalizeFipsZip(row.county_fips);
          if (fips) zipToCounty[row.region_name] = fips;
        }
      }

      const zipsWithZori = new Set<string>();
      let offset = 0;
      const pageSize = 5000;

      // Fetch ZORI data for this date (paginated)
      while (true) {
        const { data: zoriData } = await this.supabase
          .from('zillow_zip')
          .select('region_id, region_name, value')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (!zoriData || zoriData.length === 0) break;

        const recordsToUpsert: any[] = [];
        const seenInBatch = new Set<string>();

        for (const zip of zoriData) {
          const zipCode = zip.region_name;
          zipsWithZori.add(zipCode);
          if (seenInBatch.has(zipCode)) continue;
          seenInBatch.add(zipCode);
          const zori = zip.value;
          const price = priceByZip[zipCode];

          if (!zori || !price) continue;

          const capRate = calculateCapRate(zori, price);
          const grossYield = calculateGrossYield(zori, price);
          const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
          const grm = calculateGRM(price, zori);

          const zipRec: any = {
            geography_id: zipCode,
            geography_type: 'zip',
            geography_name: zipCode,
            period_date: targetDate,
            cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
            gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
            rent_to_price_ratio: rentToPriceRatio
              ? Math.round(rentToPriceRatio * 10000) / 10000
              : null,
            grm: grm ? Math.round(grm * 100) / 100 : null,
            calculated_at: new Date().toISOString(),
          };
          if (latestZipMosDate != null && targetDate === latestZipMosDate) {
            const m = zipMosInputs.get(String(zipCode));
            const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
            if (m && mos != null) {
              zipRec.months_of_supply = mos;
              zipRec.absorption_rate = calculateAbsorptionRate(
                m.pending,
                m.active,
              );
            }
          }
          recordsToUpsert.push(zipRec);
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
            totalStored += recordsToUpsert.length;
          }
        }

        totalProcessed += zoriData.length;

        if (zoriData.length < pageSize) break;
        offset += pageSize;
      }

      // ZIP fallback: estimated cap rate (paginated county ZORI)
      const countyRentByFips: Record<string, number> = {};
      const countyZoriRows: any[] = [];
      let czOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('fips_code, value')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(czOff, czOff + 1999);
        if (!page || page.length === 0) break;
        countyZoriRows.push(...page);
        if (page.length < 2000) break;
        czOff += 2000;
      }

      if (countyZoriRows.length > 0) {
        for (const r of countyZoriRows) {
          const fips = normalizeFipsZip(r.fips_code);
          if (fips && r.value) countyRentByFips[fips] = r.value;
        }
      }

      const targetYear = parseInt(targetDate.substring(0, 4));
      // Paginated HUD FMR fetch
      const fmrRows: any[] = [];
      let fmrZipOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br')
          .eq('year', targetYear)
          .not('fmr_2br', 'is', null)
          .range(fmrZipOff, fmrZipOff + 1999);
        if (!page || page.length === 0) break;
        fmrRows.push(...page);
        if (page.length < 2000) break;
        fmrZipOff += 2000;
      }

      if (fmrRows.length > 0) {
        for (const r of fmrRows) {
          const fips = normalizeFipsZip(r.fips_code);
          if (fips && r.fmr_2br && countyRentByFips[fips] == null) {
            countyRentByFips[fips] = r.fmr_2br;
          }
        }
      }

      const zipFallbackBatch: any[] = [];
      for (const [zipCode, price] of Object.entries(priceByZip)) {
        if (zipsWithZori.has(zipCode) || !price) continue;
        const countyFips = zipToCounty[zipCode];
        const countyRent = countyFips ? countyRentByFips[countyFips] : null;
        if (!countyRent) continue;

        const capRate = calculateCapRate(countyRent, price);
        const grossYield = calculateGrossYield(countyRent, price);
        const rentToPriceRatio = calculateRentToPriceRatio(countyRent, price);
        const grm = calculateGRM(price, countyRent);

        const zipFallbackRec: any = {
          geography_id: zipCode,
          geography_type: 'zip',
          geography_name: zipCode,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          calculated_at: new Date().toISOString(),
        };
        if (latestZipMosDate != null && targetDate === latestZipMosDate) {
          const m = zipMosInputs.get(String(zipCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            zipFallbackRec.months_of_supply = mos;
            zipFallbackRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        zipFallbackBatch.push(zipFallbackRec);
      }

      if (zipFallbackBatch.length > 0) {
        const zipFallbackChunkSize = 500;
        for (
          let i = 0;
          i < zipFallbackBatch.length;
          i += zipFallbackChunkSize
        ) {
          const chunk = zipFallbackBatch.slice(i, i + zipFallbackChunkSize);
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(chunk, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (!error) {
            totalStored += chunk.length;
          } else {
            errors.push(`${targetDate}: ${error.message}`);
          }
        }
      }
    }

    // ── REALTOR LISTING PRICE FALLBACK for zips without Zillow ZHVI ──
    // Zips that have Realtor median_listing_price + HUD FMR but no Zillow data
    // Use the latest ZORI date for storage alignment with ZORI-based records
    const latestZoriTargetDateZip =
      uniqueDates.length > 0 ? uniqueDates[0] : null;
    try {
      // Get latest Realtor zip date
      const { data: realtorZipLatest } = await this.supabase
        .from('realtor_zip')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (realtorZipLatest?.period_date) {
        const realtorDate = realtorZipLatest.period_date;
        const zipStoragePeriodDate = latestZoriTargetDateZip ?? realtorDate;
        const realtorYear = parseInt(realtorDate.substring(0, 4));

        // Find which zips already have cap_rate in calculated_metrics
        const existingZips = new Set<string>();
        let offset = 0;
        while (true) {
          const { data: existingRows } = await this.supabase
            .from('calculated_metrics')
            .select('geography_id')
            .eq('geography_type', 'zip')
            .not('cap_rate', 'is', null)
            .range(offset, offset + 5000 - 1);

          if (!existingRows || existingRows.length === 0) break;
          for (const r of existingRows) existingZips.add(r.geography_id);
          if (existingRows.length < 5000) break;
          offset += 5000;
        }

        // Get zip-to-county mapping from geographies table
        const zipToCountyMap: Record<string, string> = {};
        offset = 0;
        while (true) {
          const { data: geoRows } = await this.supabase
            .from('geographies')
            .select('geography_id, fips_code')
            .eq('geography_type', 'zip')
            .not('fips_code', 'is', null)
            .range(offset, offset + 5000 - 1);

          if (!geoRows || geoRows.length === 0) break;
          for (const r of geoRows) {
            if (r.fips_code) {
              const fips = /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
              zipToCountyMap[r.geography_id] = fips;
            }
          }
          if (geoRows.length < 5000) break;
          offset += 5000;
        }

        // Get HUD FMR for rent proxy (paginated)
        const fmrRowsForZip: any[] = [];
        let fzOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', realtorYear)
            .not('fmr_2br', 'is', null)
            .range(fzOff, fzOff + 1999);
          if (!page || page.length === 0) break;
          fmrRowsForZip.push(...page);
          if (page.length < 2000) break;
          fzOff += 2000;
        }

        const fmrByFipsForZip: Record<string, number> = {};
        if (fmrRowsForZip.length > 0) {
          for (const r of fmrRowsForZip) {
            const fips =
              r.fips_code && /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
            if (fips && r.fmr_2br != null) fmrByFipsForZip[fips] = r.fmr_2br;
          }
        }

        // Also get county ZORI as alternative rent
        const countyZoriForZip: Record<string, number> = {};
        const { data: latestZoriDateZip } = await this.supabase
          .from('zillow_county')
          .select('period_date')
          .eq('metric_name', 'zori')
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (latestZoriDateZip?.period_date) {
          // Paginated county ZORI fetch for ZIP fallback
          const zoriRowsZip: any[] = [];
          let zrzOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('zillow_county')
              .select('fips_code, value')
              .eq('metric_name', 'zori')
              .eq('period_date', latestZoriDateZip.period_date)
              .not('value', 'is', null)
              .range(zrzOff, zrzOff + 1999);
            if (!page || page.length === 0) break;
            zoriRowsZip.push(...page);
            if (page.length < 2000) break;
            zrzOff += 2000;
          }

          if (zoriRowsZip.length > 0) {
            for (const r of zoriRowsZip) {
              const fips =
                r.fips_code && /^\d+$/.test(r.fips_code)
                  ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                  : r.fips_code;
              if (fips && r.value) countyZoriForZip[fips] = r.value;
            }
          }
        }

        // Process Realtor zips in pages (can be 28k+)
        let realtorZipCount = 0;
        offset = 0;
        const realtorPageSize = 5000;

        while (true) {
          const { data: realtorZips } = await this.supabase
            .from('realtor_zip')
            .select('postal_code, zip_name, median_listing_price')
            .eq('period_date', realtorDate)
            .not('median_listing_price', 'is', null)
            .not('postal_code', 'is', null)
            .range(offset, offset + realtorPageSize - 1);

          if (!realtorZips || realtorZips.length === 0) break;

          const batch: any[] = [];

          for (const zip of realtorZips) {
            const zipCode = zip.postal_code;
            if (!zipCode || existingZips.has(zipCode)) continue;

            const price = zip.median_listing_price;
            if (!price || price <= 0) continue;

            const countyFips = zipToCountyMap[zipCode];
            if (!countyFips) continue;

            // Use county ZORI if available, otherwise HUD FMR
            const rent =
              countyZoriForZip[countyFips] ?? fmrByFipsForZip[countyFips];
            if (!rent || rent <= 0) continue;

            const capRate = calculateCapRate(rent, price);
            const grossYield = calculateGrossYield(rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(rent, price);
            const grm = calculateGRM(price, rent);

            const realtorZipRec: any = {
              geography_id: zipCode,
              geography_type: 'zip',
              geography_name: zip.zip_name || zipCode,
              period_date: zipStoragePeriodDate,
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
              latestZipMosDate != null &&
              zipStoragePeriodDate === latestZipMosDate
            ) {
              const m = zipMosInputs.get(String(zipCode));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorZipRec.months_of_supply = mos;
                realtorZipRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            batch.push(realtorZipRec);

            // Mark as existing so we don't double-process
            existingZips.add(zipCode);
          }

          // Upsert in chunks
          for (let i = 0; i < batch.length; i += 500) {
            const chunk = batch.slice(i, i + 500);
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(chunk, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) realtorZipCount += chunk.length;
            else errors.push(`Realtor zip fallback: ${error.message}`);
          }

          if (realtorZips.length < realtorPageSize) break;
          offset += realtorPageSize;
        }

        if (realtorZipCount > 0) {
          totalStored += realtorZipCount;
          console.log(
            `[CalculatedMetrics] Realtor zip fallback: ${realtorZipCount} zips added`,
          );
        }
      }
    } catch (e: any) {
      errors.push(`Realtor zip fallback error: ${e.message}`);
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }
}
