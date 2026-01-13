
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load env from backend package
config({ path: join(process.cwd(), 'packages/backend/.env') });

async function checkDb() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !key) {
        console.log('Skipping DB check: Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, key);

    console.log('Checking database counts for geography=County...');

    // Count exact rows
    const { count, error } = await supabase
        .from('zillow_zhvi')
        .select('*', { count: 'exact', head: true })
        .eq('geography', 'County');

    if (error) {
        console.error('DB Error:', error.message);
    } else {
        console.log('Total County records in DB (zillow_zhvi):', count);
    }
}

checkDb().catch(console.error);
