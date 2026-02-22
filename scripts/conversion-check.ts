
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

async function check() {
    const tables = ['realtor_metro', 'realtor_county', 'realtor_zip'];
    const metrics = ['median_listing_price_yy', 'active_listing_count_yy'];

    for (const table of tables) {
        console.log(`\n--- ${table} ---`);
        for (const metric of metrics) {
            const { data, error } = await s.from(table)
                .select(`*, ${metric}`)
                .gt(metric, 1)
                .lt(metric, 100)
                .limit(5);

            if (error) {
                console.error(`Error checking ${table}.${metric}:`, error);
                continue;
            }

            if (data && data.length > 0) {
                console.log(`Potential "Already Percentage" values in ${table}.${metric}:`);
                data.forEach(row => {
                    const name = row.cbsa_title || row.county_name || row.zip_name || row.region_id;
                    console.log(`  - ${name}: ${row[metric]} (becomes ${row[metric] * 100}% in UI)`);
                });
            } else {
                console.log(`No values between 1 and 100 found for ${table}.${metric}`);
            }
        }
    }
}

check().catch(console.error);
