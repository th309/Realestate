
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

async function check() {
    console.log('--- Checking Edwards, CO (Around Jan 2023) ---');
    const { data: edwards } = await s.from('realtor_metro')
        .select('cbsa_title, median_listing_price, median_listing_price_yy, period_date')
        .eq('cbsa_title', 'Edwards, CO')
        .gte('period_date', '2022-01-01')
        .lte('period_date', '2023-03-01')
        .order('period_date', { ascending: false });

    if (edwards) {
        edwards.forEach(row => {
            console.log(`Date: ${row.period_date}, Price: ${row.median_listing_price}, YY_Ratio: ${row.median_listing_price_yy}`);
        });
    }
}

check().catch(console.error);
