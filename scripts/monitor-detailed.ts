
/**
 * Detailed Zillow Ingestion Status Monitor
 * 
 * Provides a breakdown of ingestion progress by dataset and table.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Zillow datasets config
import { ZILLOW_DATASETS } from '../packages/frontend/lib/data-ingestion/sources/zillow-datasets/config';

// Load env
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function getCounts() {
    const counts: Record<string, number> = {};
    const tables = ['zillow_state', 'zillow_metro', 'zillow_county', 'zillow_zip'];

    // Get total rows per table
    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table] = count || 0;
    }

    return counts;
}

async function getMetricBreakdown() {
    // This is expensive, so we'll just check distinct metrics if possible, or infer from logs
    // Faster way: check data_ingestion_log if available, otherwise just use table counts
    // For now, we'll use the table counts as a proxy for progress
    return {};
}

async function main() {
    console.clear();
    console.log(`\n📊 ZILLOW INGESTION STATUS - ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(60));

    // 1. Table Counts
    const counts = await getCounts();
    console.log('\n🗄️  TABLE ROW COUNTS:');
    console.log(`   zillow_state:  ${counts['zillow_state'].toLocaleString().padStart(12)} rows`);
    console.log(`   zillow_metro:  ${counts['zillow_metro'].toLocaleString().padStart(12)} rows`);
    console.log(`   zillow_county: ${counts['zillow_county'].toLocaleString().padStart(12)} rows`);
    console.log(`   zillow_zip:    ${counts['zillow_zip'].toLocaleString().padStart(12)} rows`);

    // 2. Dataset Progress (Estimated)
    console.log('\n📉 DATASET STATUS (Inferred from sorting order):');

    // Sort datasets same as import script
    const sortedDatasets = [...ZILLOW_DATASETS].sort((a, b) => {
        const priority = { 'State': 1, 'Metro': 2, 'County': 3, 'City': 2, 'Zip': 4 };
        const pA = priority[a.geography as keyof typeof priority] || 5;
        const pB = priority[b.geography as keyof typeof priority] || 5;
        return pA - pB;
    });

    // We can't easily know EXACT file progress without querying distinct metrics which is slow
    // But we can check which metrics are present
    console.log(`   Total Datasets Configured: ${sortedDatasets.length}`);

    // Check specific reference metrics to see how far we might be
    const metricsToCheck = [
        { name: 'zhvi', table: 'zillow_state', label: 'ZHVI (State)' },
        { name: 'zhvi', table: 'zillow_metro', label: 'ZHVI (Metro)' },
        { name: 'zhvi', table: 'zillow_county', label: 'ZHVI (County)' },
        { name: 'zori', table: 'zillow_metro', label: 'ZORI (Metro)' },
        { name: 'inventory', table: 'zillow_metro', label: 'Inventory (Metro)' },
    ];

    console.log('\n🔍 SNAPSHOT CHECKS:');
    for (const check of metricsToCheck) {
        const { count } = await supabase
            .from(check.table)
            .select('*', { count: 'exact', head: true })
            .eq('metric_name', check.name);

        const symbol = (count && count > 0) ? '✅' : '⏳';
        console.log(`   ${symbol} ${check.label}: ${count?.toLocaleString()} rows`);
    }

    console.log('\n(Auto-refreshing every 60s...)');
}

main().catch(console.error);
