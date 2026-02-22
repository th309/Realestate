
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOutliers() {
    console.log('--- Starting Enhanced Data Audit ---');

    // 1. Check Zillow Tables (Long Format)
    const zillowTables = ['zillow_metro', 'zillow_county', 'zillow_zip', 'zillow_state'];
    const zillowMetrics = ['zhvi', 'zori', 'zhvf_12m', 'years_to_save'];

    for (const table of zillowTables) {
        console.log(`\nChecking Zillow table: ${table}`);
        for (const metric of zillowMetrics) {
            const { data: outliers, error } = await supabase
                .from(table)
                .select('*, value')
                .eq('metric_name', metric)
                .or('value.gt.10000000,value.lt.-1000') // Very loose for raw values, just to see what's there
                .limit(5);

            if (error) {
                console.error(`Error fetching ${metric} from ${table}:`, error);
                continue;
            }
            if (outliers && outliers.length > 0) {
                console.log(`[ALERT] Found potential outliers for ${metric} in ${table}`);
            }
        }
    }

    // 2. Check Realtor Tables (Wide Format - Likely where the 1800% is)
    const realtorTables = [
        { name: 'realtor_metro', id: 'cbsa_code' },
        { name: 'realtor_county', id: 'county_fips' },
        { name: 'realtor_zip', id: 'postal_code' }
    ];

    // YY columns are decimal (e.g. 0.1 = 10%). 1800% would be 18.0
    const realtorMetrics = ['median_listing_price_yy', 'active_listing_count_yy', 'new_listing_count_yy'];

    for (const table of realtorTables) {
        console.log(`\nChecking Realtor table: ${table.name}`);
        for (const metric of realtorMetrics) {
            const { data: outliers, error } = await supabase
                .from(table.name)
                .select(`*, ${metric}`)
                .or(`${metric}.gt.0.5,${metric}.lt.-0.5`) // Check for > 50% or < -50%
                .order(metric, { ascending: false })
                .limit(10);

            if (error) {
                console.error(`Error fetching ${metric} from ${table.name}:`, error);
                continue;
            }

            if (outliers && outliers.length > 0) {
                console.log(`[ALERT] Found ${outliers.length} extreme YoY outliers for ${metric} in ${table.name}:`);
                outliers.forEach(o => {
                    const val = o[metric] * 100;
                    const name = o.cbsa_title || o.county_name || o.zip_name || o[table.id];
                    console.log(`  - ${name}: ${val.toFixed(1)}% on ${o.period_date}`);
                });
            }
        }
    }

    console.log('\n--- Enhanced Data Audit Complete ---');
}

checkOutliers().catch(console.error);
