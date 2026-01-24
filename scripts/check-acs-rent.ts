import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  // Paginate to get all unique counties
  const countyIds = new Set<string>();
  let offset = 0;
  const PAGE_SIZE = 1000;

  console.log('Fetching unique counties with median_gross_rent...');
  while (true) {
    const { data: countyData, error } = await supabase
      .from('census_county')
      .select('fips_code, median_gross_rent')
      .not('median_gross_rent', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.log('Error:', error.message);
      break;
    }
    if (!countyData || countyData.length === 0) break;
    countyData.forEach((r: { fips_code: string }) => countyIds.add(r.fips_code));
    if (offset === 0) {
      console.log('Sample county:', countyData[0]);
    }
    if (countyData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    console.log(`  Processed ${offset} county records...`);
  }
  console.log('Unique counties with median_gross_rent:', countyIds.size);

  // First find the column names in census_zip
  const { data: zipSample } = await supabase.from('census_zip').select('*').limit(1);
  if (zipSample?.[0]) {
    console.log('\ncensus_zip columns:', Object.keys(zipSample[0]));
  }

  // Try postal_code or zcta
  const zipIdCol = zipSample?.[0] && 'postal_code' in zipSample[0] ? 'postal_code' : 'zcta';
  console.log(`Using ZIP id column: ${zipIdCol}`);

  // Check ZIP coverage - paginate through
  const zipIds = new Set<string>();
  offset = 0;
  console.log('\nFetching unique ZIPs with median_gross_rent...');
  while (true) {
    const { data: zipData, error } = await supabase
      .from('census_zip')
      .select(`${zipIdCol}, median_gross_rent`)
      .not('median_gross_rent', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.log('Error:', error.message);
      break;
    }
    if (!zipData || zipData.length === 0) break;
    zipData.forEach((r: Record<string, unknown>) => zipIds.add(String(r[zipIdCol])));
    if (offset === 0) {
      console.log('Sample ZIP:', zipData[0]);
    }
    if (zipData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset % 10000 === 0) console.log(`  Processed ${offset} ZIP records...`);
  }
  console.log('Unique ZIPs with median_gross_rent:', zipIds.size);
}

main().catch(console.error);
