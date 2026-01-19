
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
    console.log('--- Debugging County Metrics Data ---');

    // Check County ZORI
    const { count: zoriCountyCount } = await supabase
        .from('zillow_county')
        .select('*', { count: 'exact', head: true })
        .eq('metric_name', 'zori');
    console.log(`zillow_county (ZORI) count: ${zoriCountyCount}`);

    // Check County Realtor
    const { count: realtorCountyCount } = await supabase
        .from('realtor_county')
        .select('*', { count: 'exact', head: true })
        .not('median_listing_price', 'is', null);
    console.log(`realtor_county (Price) count: ${realtorCountyCount}`);
}

main().catch(console.error);
