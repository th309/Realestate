
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

async function check() {
    const { data: sherman } = await s.from('realtor_county')
        .select('county_name, median_listing_price, median_listing_price_yy, period_date')
        .eq('county_name', 'sherman, or')
        .eq('period_date', '2022-04-01');
    console.log('Sherman Outlier:', JSON.stringify(sherman, null, 2));

    // Also check the previous year for context
    const { data: shermanPrev } = await s.from('realtor_county')
        .select('county_name, median_listing_price, period_date')
        .eq('county_name', 'sherman, or')
        .eq('period_date', '2021-04-01');
    console.log('Sherman Previous Year:', JSON.stringify(shermanPrev, null, 2));
}

check().catch(console.error);
