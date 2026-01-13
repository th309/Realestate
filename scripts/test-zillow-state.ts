
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing creds");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
    console.log("Testing single insert to zillow_state...");
    const { data, error } = await supabase.from('zillow_state').upsert({
        region_id: 999999,
        region_name: 'Test Region',
        state_code: 'TX',
        period_date: '2025-01-01',
        metric_name: 'test',
        value: 123
    });

    if (error) {
        console.error("❌ Insert failed:", error);
    } else {
        console.log("✅ Insert successful");
        // Clean up
        await supabase.from('zillow_state').delete().eq('region_id', 999999);
        console.log("✅ Cleanup successful");
    }
}

testInsert();
