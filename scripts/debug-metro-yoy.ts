import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
  console.log('Debugging Metro YoY calculation...\n');

  // Get a sample Metro record needing YoY
  const { data: records, error } = await supabase
    .from('zillow_zhvi')
    .select('id, region_id, date, value, property_type, tier, yoy_growth')
    .eq('geography', 'Metro')
    .is('yoy_growth', null)
    .order('date', { ascending: false })
    .limit(5);

  if (error) {
    console.log('Error fetching records:', error);
    return;
  }

  console.log('Sample Metro records needing YoY:', records);

  if (!records || records.length === 0) {
    console.log('No records found needing YoY');
    return;
  }

  // For the first record, try to find the previous year's data
  const record = records[0];
  console.log('\nLooking up previous year for:', record);

  const previousDate = new Date(record.date);
  previousDate.setFullYear(previousDate.getFullYear() - 1);
  const prevDateStr = previousDate.toISOString().split('T')[0];

  console.log('Looking for date:', prevDateStr);

  const { data: prevRecord, error: prevError } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .eq('region_id', record.region_id)
    .eq('property_type', record.property_type)
    .eq('tier', record.tier)
    .eq('geography', 'Metro')
    .eq('date', prevDateStr);

  console.log('Previous record lookup result:', prevRecord);
  console.log('Previous record error:', prevError);

  // Check what dates exist for this region_id
  console.log('\nAll dates for this region_id in Metro:');
  const { data: allDates } = await supabase
    .from('zillow_zhvi')
    .select('date, value')
    .eq('region_id', record.region_id)
    .eq('geography', 'Metro')
    .eq('property_type', record.property_type)
    .eq('tier', record.tier)
    .order('date', { ascending: false })
    .limit(15);

  console.log(allDates);
}

debug().catch(console.error);
