import { SupabaseClient } from '@supabase/supabase-js';
import { BATCH_SIZE } from './inventory-surplus.types';
import { calculate5YearAverage } from './inventory-surplus-calculation.helper';
import { getHistoricalInventory } from './inventory-surplus-history.helper';

/**
 * Calculate and store inventory surplus for all metros
 */
export async function calculateForMetros(
  supabase: SupabaseClient,
  year?: number,
): Promise<{
  processed: number;
  stored: number;
  debug?: any;
}> {
  // Get ALL unique dates (descending)
  const { data: allDates } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false });

  let uniqueDates = Array.from(
    new Set(allDates?.map((d) => d.period_date) || []),
  );

  if (year) {
    console.log(`[InventorySurplus] Filtering metros for year: ${year}`);
    uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
  }

  let totalProcessed = 0;
  let totalStored = 0;
  const allUpsertErrors: string[] = [];

  console.log(
    `[InventorySurplus] Backfilling metros for ${uniqueDates.length} dates...`,
  );

  for (const dateStr of uniqueDates) {
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    const { data: currentData } = await supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title, active_listing_count')
      .eq('period_date', dateStr)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) continue;

    const historicalByRegion = await getHistoricalInventory(
      supabase,
      'realtor_metro',
      'cbsa_code',
      targetYear,
      targetMonth,
      targetDay,
    );

    let recordsToUpsert: any[] = [];

    for (const metro of currentData) {
      const historicalValues = historicalByRegion.get(metro.cbsa_code);
      const avg = calculate5YearAverage(historicalValues || []);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((metro.active_listing_count - avg) / avg) * 100;

      recordsToUpsert.push({
        geography_id: metro.cbsa_code,
        geography_type: 'metro',
        geography_name: metro.cbsa_title,
        period_date: dateStr,
        inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= BATCH_SIZE) {
        const { error } = await supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (error) {
          allUpsertErrors.push(`${dateStr}: ${error.message}`);
        } else {
          totalStored += recordsToUpsert.length;
        }
        recordsToUpsert = [];
      }
    }

    // Upsert remaining records
    if (recordsToUpsert.length > 0) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) {
        allUpsertErrors.push(`${dateStr} (last batch): ${error.message}`);
      } else {
        totalStored += recordsToUpsert.length;
      }
    }
    totalProcessed += currentData.length;
  }

  return {
    processed: totalProcessed,
    stored: totalStored,
    debug: {
      errors: allUpsertErrors.length > 0 ? allUpsertErrors : undefined,
    },
  };
}

/**
 * Calculate and store inventory surplus for all states
 */
export async function calculateForStates(
  supabase: SupabaseClient,
  year?: number,
): Promise<{ processed: number; stored: number }> {
  // Get ALL unique dates (descending)
  const { data: allDates } = await supabase
    .from('realtor_state')
    .select('period_date')
    .order('period_date', { ascending: false });

  let uniqueDates = Array.from(
    new Set(allDates?.map((d) => d.period_date) || []),
  );

  if (year) {
    console.log(`[InventorySurplus] Filtering states for year: ${year}`);
    uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
  }

  let totalProcessed = 0;
  let totalStored = 0;

  console.log(
    `[InventorySurplus] Backfilling states for ${uniqueDates.length} dates...`,
  );

  for (const dateStr of uniqueDates) {
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    const { data: currentData } = await supabase
      .from('realtor_state')
      .select('state_id, state_name, active_listing_count')
      .eq('period_date', dateStr)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) continue;

    const historicalByRegion = await getHistoricalInventory(
      supabase,
      'realtor_state',
      'state_id',
      targetYear,
      targetMonth,
      targetDay,
    );

    const recordsToUpsert: any[] = [];

    for (const state of currentData) {
      const historicalValues = historicalByRegion.get(state.state_id);
      const avg = calculate5YearAverage(historicalValues || []);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((state.active_listing_count - avg) / avg) * 100;

      recordsToUpsert.push({
        geography_id: state.state_id,
        geography_type: 'state',
        geography_name: state.state_name,
        period_date: dateStr,
        inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) totalStored += recordsToUpsert.length;
    }

    totalProcessed += currentData.length;
  }

  console.log(
    `[InventorySurplus] Finished states. Processed: ${totalProcessed}, Stored: ${totalStored}`,
  );
  return { processed: totalProcessed, stored: totalStored };
}
