import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../common/zip';
import { PAGE_SIZE, BATCH_SIZE } from './inventory-surplus.types';
import { calculate5YearAverage } from './inventory-surplus-calculation.helper';
import { getHistoricalInventoryPaginated } from './inventory-surplus-history.helper';

/**
 * Calculate and store inventory surplus for all counties (paginated)
 */
export async function calculateForCounties(
  supabase: SupabaseClient,
  year?: number,
): Promise<{ processed: number; stored: number }> {
  const { data: latestDateRow } = await supabase
    .from('realtor_county')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = new Date(latestDateRow.period_date);
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1;
  const targetDay = targetDate.getUTCDate();

  // Get all current data (paginated)
  const allCurrentData: any[] = [];
  let offset = 0;
  while (true) {
    const { data: pageData } = await supabase
      .from('realtor_county')
      .select('county_fips, county_name, active_listing_count')
      .eq('period_date', latestDateRow.period_date)
      .not('active_listing_count', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!pageData || pageData.length === 0) break;
    allCurrentData.push(...pageData);
    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (allCurrentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  // Get historical data (paginated for each year)
  const historicalByRegion = await getHistoricalInventoryPaginated(
    supabase,
    'realtor_county',
    'county_fips',
    targetYear,
    targetMonth,
    targetDay,
  );

  // Calculate and batch upsert
  let stored = 0;
  const recordsToUpsert: any[] = [];

  for (const county of allCurrentData) {
    const historicalValues = historicalByRegion.get(county.county_fips);
    const avg = calculate5YearAverage(historicalValues || []);

    if (avg === null) continue;

    // Calculate as percentage: ((current - avg) / avg) * 100
    const surplusPct = ((county.active_listing_count - avg) / avg) * 100;

    recordsToUpsert.push({
      geography_id: county.county_fips,
      geography_type: 'county',
      geography_name: county.county_name,
      period_date: latestDateRow.period_date,
      inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
      calculated_at: new Date().toISOString(),
    });

    if (recordsToUpsert.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
      recordsToUpsert.length = 0;
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(recordsToUpsert, {
        onConflict: 'geography_id,geography_type,period_date',
      });
    if (!error) stored += recordsToUpsert.length;
  }

  return { processed: allCurrentData.length, stored };
}

/**
 * Calculate and store inventory surplus for all zip codes (paginated)
 */
export async function calculateForZips(
  supabase: SupabaseClient,
  year?: number,
): Promise<{ processed: number; stored: number }> {
  const { data: latestDateRow } = await supabase
    .from('realtor_zip')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = new Date(latestDateRow.period_date);
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1;
  const targetDay = targetDate.getUTCDate();

  // Get all current data (paginated)
  const allCurrentData: any[] = [];
  let offset = 0;
  while (true) {
    const { data: pageData } = await supabase
      .from('realtor_zip')
      .select('postal_code, zip_name, active_listing_count')
      .eq('period_date', latestDateRow.period_date)
      .not('active_listing_count', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!pageData || pageData.length === 0) break;
    allCurrentData.push(...pageData);
    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (allCurrentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  // Get historical data (paginated)
  const historicalByRegion = await getHistoricalInventoryPaginated(
    supabase,
    'realtor_zip',
    'postal_code',
    targetYear,
    targetMonth,
    targetDay,
  );

  // Calculate and batch upsert
  let stored = 0;
  const recordsToUpsert: any[] = [];

  for (const zip of allCurrentData) {
    const historicalValues = historicalByRegion.get(zip.postal_code);
    const avg = calculate5YearAverage(historicalValues || []);

    if (avg === null) continue;

    // Calculate as percentage: ((current - avg) / avg) * 100
    const surplusPct = ((zip.active_listing_count - avg) / avg) * 100;

    recordsToUpsert.push({
      geography_id: normalizeZipKey(String(zip.postal_code)),
      geography_type: 'zip',
      geography_name: zip.zip_name,
      period_date: latestDateRow.period_date,
      inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
      calculated_at: new Date().toISOString(),
    });

    if (recordsToUpsert.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
      recordsToUpsert.length = 0;
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(recordsToUpsert, {
        onConflict: 'geography_id,geography_type,period_date',
      });
    if (!error) stored += recordsToUpsert.length;
  }

  return { processed: allCurrentData.length, stored };
}
