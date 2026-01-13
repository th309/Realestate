
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyTables() {
    console.log('🔍 Verifying Zillow Data Tables...\n');

    const tables = ['zillow_state', 'zillow_metro', 'zillow_county', 'zillow_zip'];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.error(`❌ Error querying ${table}: ${error.message}`);
                continue;
            }

            console.log(`✅ ${table}: ${count?.toLocaleString()} rows`);

            // Sample check
            const { data, error: sampleError } = await supabase
                .from(table)
                .select('region_name, metric_name, period_date, value')
                .limit(1);

            if (!sampleError && data && data.length > 0) {
                console.log(`   Sample: ${data[0].metric_name} in ${data[0].region_name} on ${data[0].period_date}: ${data[0].value}`);
            }

        } catch (e: any) {
            console.error(`❌ Exception checking ${table}: ${e.message}`);
        }
    }
}

verifyTables()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
