
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Debugging Metrics Data ---');

    // 1. Check ZORI Zip Data
    const { count: zoriZipCount, data: zoriZipExample } = await supabase
        .from('zillow_zip')
        .select('*', { count: 'exact', head: true })
        .eq('metric_name', 'zori');

    console.log(`zillow_zip (ZORI) count: ${zoriZipCount}`);
    if (zoriZipExample && zoriZipExample.length > 0) {
        console.log('Sample ZORI Zip:', zoriZipExample[0]);
    }

    // 2. Check Realtor Zip Data
    const { count: realtorZipCount, data: realtorZipExample } = await supabase
        .from('realtor_zip')
        .select('*', { count: 'exact', head: true })
        .not('median_listing_price', 'is', null);

    console.log(`realtor_zip (Price) count: ${realtorZipCount}`);
    if (realtorZipExample && realtorZipExample.length > 0) {
        console.log('Sample Realtor Zip:', realtorZipExample[0]);
    }

    // 3. Check Dates
    const { data: zoriDates } = await supabase
        .from('zillow_zip')
        .select('period_date')
        .eq('metric_name', 'zori')
        .order('period_date', { ascending: false })
        .limit(1);

    const { data: realtorDates } = await supabase
        .from('realtor_zip')
        .select('period_date')
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: false })
        .limit(1);

    console.log('Latest ZORI Zip Date:', zoriDates?.[0]?.period_date);
    console.log('Latest Realtor Zip Date:', realtorDates?.[0]?.period_date);

    // 4. Check County overlap
    const { count: zoriCountyCount } = await supabase
        .from('zillow_county')
        .select('*', { count: 'exact', head: true })
        .eq('metric_name', 'zori');
    console.log(`zillow_county (ZORI) count: ${zoriCountyCount}`);

    const { count: realtorCountyCount } = await supabase
        .from('realtor_county')
        .select('*', { count: 'exact', head: true })
        .not('median_listing_price', 'is', null);
    console.log(`realtor_county (Price) count: ${realtorCountyCount}`);

}

main().catch(console.error);
