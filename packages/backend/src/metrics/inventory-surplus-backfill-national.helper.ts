import { SupabaseClient } from '@supabase/supabase-js';
import { calculate5YearAverage } from './inventory-surplus-calculation.helper';

/**
 * Calculate and store inventory surplus for national level
 */
export async function calculateForNational(
  supabase: SupabaseClient,
  year?: number,
): Promise<{ processed: number; stored: number }> {
  // Get ALL unique dates (descending)
  const { data: allDates } = await supabase
    .from('realtor_national')
    .select('period_date')
    .order('period_date', { ascending: false });

  let uniqueDates = Array.from(
    new Set(allDates?.map((d) => d.period_date) || []),
  );

  if (year) {
    console.log(`[InventorySurplus] Filtering national for year: ${year}`);
    uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
  }

  let totalProcessed = 0;
  let totalStored = 0;

  for (const dateStr of uniqueDates) {
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    // Get current national inventory
    const { data: currentData } = await supabase
      .from('realtor_national')
      .select('country, active_listing_count')
      .eq('period_date', dateStr)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) continue;

    // Get historical data for national level
    const historicalValues: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const year = targetYear - i;
      const month = String(targetMonth).padStart(2, '0');
      const day = String(targetDay).padStart(2, '0');
      const pastDateStr = `${year}-${month}-${day}`;

      const { data } = await supabase
        .from('realtor_national')
        .select('active_listing_count')
        .eq('period_date', pastDateStr)
        .not('active_listing_count', 'is', null)
        .single();

      if (data?.active_listing_count) {
        historicalValues.push(data.active_listing_count);
      }
    }

    for (const national of currentData) {
      const avg = calculate5YearAverage(historicalValues);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((national.active_listing_count - avg) / avg) * 100;

      const { error } = await supabase.from('calculated_metrics').upsert(
        {
          geography_id: 'US',
          geography_type: 'national',
          geography_name: national.country || 'United States',
          period_date: dateStr,
          inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'geography_id,geography_type,period_date' },
      );

      if (!error) totalStored++;
    }
    totalProcessed += currentData.length;
  }

  return { processed: totalProcessed, stored: totalStored };
}
