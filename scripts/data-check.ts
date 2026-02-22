
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

async function check() {
    console.log('--- Checking Multnomah, OR (Major Area) ---');
    const { data: multnomah } = await s.from('realtor_county')
        .select('county_name, median_listing_price, median_listing_price_yy, period_date')
        .eq('county_name', 'multnomah, or')
        .order('period_date', { ascending: false })
        .limit(5);
    console.log('Multnomah County:', JSON.stringify(multnomah, null, 2));
}

check().catch(console.error);
