
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

const sql = `
GRANT ALL ON TABLE zillow_state TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_metro TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_county TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zip TO postgres, service_role, dashboard_user, anon, authenticated;

GRANT ALL ON TABLE zillow_zhvi TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zori TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zhvf TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zordi TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_new_listings TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_pending_listings TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_median_list_price TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_sale_to_list TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_days_to_close TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_price_cut_share TO postgres, service_role, dashboard_user, anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, dashboard_user, anon, authenticated;
`;

async function main() {
    console.log(`🔌 Connecting to Supabase via RPC at ${supabaseUrl}...`);

    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.error('❌ Error executing SQL via RPC:', error);

        // Try alternate input format if parameter name is different
        console.log('🔄 Trying alternate RPC parameter format...');
        const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql: sql });

        if (error2) {
            console.error('❌ Error executing SQL via RPC (attempt 2):', error2);
            console.log('💡 If exec_sql function does not exist, we cannot use this method.');
        } else {
            console.log('✅ Permissions granted successfully (attempt 2).');
        }
    } else {
        console.log('✅ Permissions granted successfully.');
    }
}

main().catch(e => {
    console.error('❌ Exception:', e);
    process.exit(1);
});
