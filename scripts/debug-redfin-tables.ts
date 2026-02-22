import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTables() {
    console.log('🔍 Debugging Redfin Tables');

    const tablesToCheck = ['redfin_metrics', 'redfin_metrics_2024', 'redfin_metrics_2025', 'redfin_county', 'redfin_city', 'redfin_zip'];

    for (const table of tablesToCheck) {
        console.log(`\n📋 Checking table: ${table}`);

        // Check if table exists and get columns
        const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: table });

        if (colError) {
            // get_table_columns might not exist, try a simple select to see keys
            const { data: sample, error: existError } = await supabase.from(table).select('*').limit(1);
            if (existError) {
                console.log(`   ❌ Table error: ${existError.message}`);
            } else {
                console.log(`   ✅ Table exists. Columns: ${Object.keys(sample[0] || {}).join(', ')}`);
            }
        } else {
            console.log(`   ✅ Table found with ${cols.length} columns`);
        }

        // Check constraints via SQL RPC if possible, or just raw query
        const { data: constraints, error: constError } = await supabase.rpc('execute_sql', {
            sql_query: `
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_class t ON c.conrelid = t.oid 
        WHERE t.relname = '${table}'
      `
        });

        if (constError) {
            console.log(`   ℹ️ Could not check constraints via RPC: ${constError.message}`);
            // List of common constraint names to check
            const potentialConstraints = [
                `${table}_unique`,
                `${table}_geoid_metric_date_key`,
                `${table}_geoid_metric_date_property_type_key`
            ];

            console.log(`   🔎 Checking potential constraints...`);
            // Since we can't run arbitrary SQL easily if execute_sql is missing,
            // let's try to infer from the error message we saw in the benchmark.
            const foundConstraints = potentialConstraints.filter(pc => constError.message.includes(pc));
            if (foundConstraints.length > 0) {
                console.log(`   ✅ Found potential constraints in error message: ${foundConstraints.join(', ')}`);
            } else {
                console.log(`   ❌ No common constraints found in error message.`);
            }
        } else {
            console.log(`   🔗 Constraints:`);
            console.table(constraints);
        }
    }
}

debugTables().catch(console.error);
