import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDates() {
  console.log('Checking realtor_metro date range...\n');

  // Get earliest date
  const { data: earliest, error: earliestError } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: true })
    .limit(1)
    .single();

  if (earliestError) {
    console.error('Error getting earliest date:', earliestError.message);
  } else {
    console.log('Earliest date:', earliest?.period_date);
  }

  // Get latest date
  const { data: latest, error: latestError } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (latestError) {
    console.error('Error getting latest date:', latestError.message);
  } else {
    console.log('Latest date:', latest?.period_date);
  }

  // Calculate what 5 years ago would be
  if (latest?.period_date) {
    const latestDate = new Date(latest.period_date);
    const fiveYearsAgo = new Date(latestDate);
    fiveYearsAgo.setFullYear(latestDate.getFullYear() - 5);
    console.log('\nFor 5-year calculation:');
    console.log('  Current date:', latest.period_date);
    console.log('  5 years ago:', fiveYearsAgo.toISOString().split('T')[0]);
    
    if (earliest?.period_date) {
      const earliestDate = new Date(earliest.period_date);
      if (earliestDate <= fiveYearsAgo) {
        console.log('  ✅ Data goes back far enough for 5-year calculation');
      } else {
        console.log('  ❌ Data does NOT go back far enough');
        console.log('  Gap:', Math.round((earliestDate.getTime() - fiveYearsAgo.getTime()) / (1000 * 60 * 60 * 24)), 'days');
      }
    }
  }

  // Check how many records exist around the 5-year-ago date
  if (latest?.period_date) {
    const latestDate = new Date(latest.period_date);
    const fiveYearsAgo = new Date(latestDate);
    fiveYearsAgo.setFullYear(latestDate.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
    const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { count, error: countError } = await supabase
      .from('realtor_metro')
      .select('*', { count: 'exact', head: true })
      .gte('period_date', pastDateStr)
      .lte('period_date', pastDateMax)
      .not('median_listing_price', 'is', null);

    if (countError) {
      console.error('Error counting records:', countError.message);
    } else {
      console.log(`\nRecords with median_listing_price between ${pastDateStr} and ${pastDateMax}: ${count}`);
    }
  }

  // Get the earliest dates for comparison
  const { data: earlyDates } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true })
    .limit(5);

  if (earlyDates && earlyDates.length > 0) {
    console.log('\nEarliest dates with median_listing_price data:');
    const uniqueDates = [...new Set(earlyDates.map(d => d.period_date))];
    uniqueDates.forEach(d => console.log('  ', d));
  }
}

checkDates().catch(console.error);
