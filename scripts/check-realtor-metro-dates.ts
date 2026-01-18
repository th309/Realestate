import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

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
