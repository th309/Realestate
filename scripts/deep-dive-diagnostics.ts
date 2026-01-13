
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import dns from 'dns';
import os from 'os';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Extract hostname from URL
const urlObj = new URL(supabaseUrl);
const hostname = urlObj.hostname;

console.log('🔍 System & Network Diagnostic');
console.log('============================');
console.log(`OS: ${os.platform()} ${os.release()}`);
console.log(`Node: ${process.version}`);
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Hostname: ${hostname}`);

async function runDiagnostics() {
    // 1. DNS Lookup
    console.log('\n1️⃣  Testing DNS Resolution...');
    try {
        const addresses = await dns.promises.resolve4(hostname);
        console.log(`   ✅ Resolved ${hostname} to: ${addresses.join(', ')}`);
    } catch (e: any) {
        console.error(`   ❌ DNS Lookup Failed: ${e.message}`);
    }

    // 2. Fetch Connectivity
    console.log('\n2️⃣  Testing Basic Connectivity (fetch)...');
    try {
        const start = Date.now();
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { 'apikey': supabaseServiceKey }
        });
        const duration = Date.now() - start;
        console.log(`   ✅ Fetch Status: ${res.status} (${res.statusText}) - ${duration}ms`);
    } catch (e: any) {
        console.error(`   ❌ Fetch Failed: ${e.message}`);
        // Log full error details
        console.dir(e, { depth: null });
    }

    // 3. Supabase Client Upsert Test
    console.log('\n3️⃣  Testing Supabase Client Upsert...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' }
    });

    const testRecord = {
        region_id: 999999,
        region_name: 'TEST_REGION_DIAGNOSTIC',
        state_code: 'XX',
        period_date: '2025-01-01',
        metric_name: 'test_metric',
        value: 123.45
    };

    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('zillow_metro')
            .upsert([testRecord], { onConflict: 'region_id,period_date,metric_name' })
            .select();

        const duration = Date.now() - start;

        if (error) {
            console.error(`   ❌ Upsert Error: ${error.message}`);
            console.error(`   Details: ${JSON.stringify(error)}`);
        } else {
            console.log(`   ✅ Upsert Successful - ${duration}ms`);
            console.log(`   Cleaning up...`);
            await supabase.from('zillow_metro').delete().eq('region_id', 999999);
        }
    } catch (e: any) {
        console.error(`   ❌ Upsert Exception: ${e.message}`);
        if (e.cause) console.error(`   Cause:`, e.cause);
    }
}

runDiagnostics().catch(console.error);
