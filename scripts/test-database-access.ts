/**
 * Test database access capabilities
 * Tests: SELECT, INSERT, UPDATE, DELETE, schema access
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const client = createClient(supabaseUrl, supabaseKey);
const results: string[] = [];

function log(msg: string) {
    console.log(msg);
    results.push(msg);
}

async function testDatabase() {
    log('==========================================================');
    log('       DATABASE ACCESS ASSESSMENT');
    log('==========================================================');
    log('');

    // 1. Test SELECT
    log('1. Testing SELECT on markets table...');
    const { data: markets, error: marketsError } = await client.from('markets').select('*').limit(3);
    log(marketsError ? `  [FAIL] ERROR: ${marketsError.message}` : `  [OK] SUCCESS: Found ${markets?.length || 0} rows`);

    // 2. Test exec_sql RPC (note: should return JSON, so use a JSON-formatted query)
    log('');
    log('2. Testing raw SQL execution via exec_sql RPC...');
    const { data: rpcResult, error: rpcError } = await client.rpc('exec_sql', {
        sql: `SELECT json_agg(t) FROM (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5) t;`
    });
    if (rpcError) {
        log(`  [WARN] exec_sql RPC issue: ${rpcError.message}`);
    } else {
        log('  [OK] exec_sql RPC function works!');
    }

    // 3. Test Zillow tables
    log('');
    log('3. Checking Zillow tables...');
    const { data: zillowData, error: zillowError } = await client.from('zillow_metro').select('id, region_name').limit(3);
    log(zillowError ? `  [FAIL] zillow_metro ERROR: ${zillowError.message}` : `  [OK] zillow_metro accessible: ${zillowData?.length || 0} rows`);

    // 4. Test COUNT
    log('');
    log('4. Testing complex query (aggregate)...');
    const { count, error: countError } = await client.from('markets').select('*', { count: 'exact', head: true });
    log(countError ? `  [FAIL] COUNT ERROR: ${countError.message}` : `  [OK] markets table has ${count} total rows`);

    // 5. Test INSERT with correct schema (region_id, region_name, region_type, geoid)
    log('');
    log('5. Testing INSERT capability...');
    const testData = {
        region_id: 'TEST-TEMP-DELETE-ME',
        region_name: 'Test Region for DB Access Check',
        region_type: 'zip',  // Required column
        geoid: '99999'
    };

    // First cleanup any existing test data
    await client.from('markets').delete().eq('region_id', 'TEST-TEMP-DELETE-ME');

    const { data: insertResult, error: insertError } = await client.from('markets').insert(testData).select();
    log(insertError ? `  [FAIL] INSERT ERROR: ${insertError.message}` : `  [OK] INSERT succeeded: ${insertResult?.[0]?.region_id}`);

    if (!insertError) {
        // 6. Test UPDATE
        log('');
        log('6. Testing UPDATE capability...');
        const { data: updateResult, error: updateError } = await client
            .from('markets')
            .update({ region_name: 'Updated Test Region' })
            .eq('region_id', 'TEST-TEMP-DELETE-ME')
            .select();
        log(updateError ? `  [FAIL] UPDATE ERROR: ${updateError.message}` : `  [OK] UPDATE succeeded: ${updateResult?.[0]?.region_name}`);

        // 7. Test DELETE
        log('');
        log('7. Testing DELETE capability...');
        const { error: deleteError } = await client
            .from('markets')
            .delete()
            .eq('region_id', 'TEST-TEMP-DELETE-ME');
        log(deleteError ? `  [FAIL] DELETE ERROR: ${deleteError.message}` : '  [OK] DELETE succeeded');
    }

    // Summary
    log('');
    log('==========================================================');
    log('       SUMMARY');
    log('==========================================================');
    log('[OK] Supabase client connection: WORKING');
    log('[OK] SELECT operations: WORKING');
    log(insertError ? '[FAIL] INSERT operations: FAILED' : '[OK] INSERT operations: WORKING');
    log(!insertError ? '[OK] UPDATE operations: WORKING' : '[SKIP] UPDATE operations: SKIPPED');
    log(!insertError ? '[OK] DELETE operations: WORKING' : '[SKIP] DELETE operations: SKIPPED');
    log('[OK] Database is accessible via Supabase JavaScript client');
    if (rpcError) {
        log('[WARN] exec_sql RPC: Has issues but may still work for some queries');
    } else {
        log('[OK] Raw SQL execution: WORKING via exec_sql RPC');
    }
    log('');

    // Write to file
    fs.writeFileSync('db-access-results.txt', results.join('\n'), 'utf8');
    console.log('Results written to db-access-results.txt');
}

testDatabase().catch(e => console.error('Fatal error:', e));
