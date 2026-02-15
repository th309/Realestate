/**
 * Check Data Ingestion Status
 * 
 * Provides a comprehensive status report on data ingestion progress.
 * Run with: node scripts/check-ingestion-status.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

async function checkStatus() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           📊 DATA INGESTION STATUS REPORT                  ║');
    console.log('║           ' + new Date().toISOString() + '           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // ========================================================================
    // 1. Check for running imports (data_ingestion_log with no completed_at)
    // ========================================================================
    console.log('🔄 ACTIVE IMPORTS (Running):');
    console.log('────────────────────────────────────────────────────────────');

    const { data: runningLogs, error: runningError } = await supabase
        .from('data_ingestion_log')
        .select('*')
        .is('completed_at', null)
        .order('started_at', { ascending: false });

    if (runningError) {
        console.log('  ⚠️  Could not query running imports:', runningError.message);
    } else if (runningLogs && runningLogs.length > 0) {
        runningLogs.forEach((log, i) => {
            const elapsed = log.started_at
                ? Math.round((Date.now() - new Date(log.started_at).getTime()) / 1000)
                : 0;

            // Calculate percentage
            const total = log.records_processed || 0;
            const success = log.records_success || 0;
            const errors = log.records_error || 0;
            const completed = success + errors;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Dataset name from dataset_id or metric_name
            const dataset = log.dataset_id || log.metric_name || log.table_name;

            console.log('');
            console.log(`  📦 ${log.source.toUpperCase()} - ${dataset}`);
            console.log(`     ┌─────────────────────────────────────────────────`);

            // Progress bar
            const barWidth = 30;
            const filled = Math.round((percent / 100) * barWidth);
            const empty = barWidth - filled;
            const progressBar = '█'.repeat(filled) + '░'.repeat(empty);

            console.log(`     │ Progress: [${progressBar}] ${percent}%`);
            console.log(`     │ Records:  ${success.toLocaleString()} of ${total.toLocaleString()} imported`);
            if (errors > 0) {
                console.log(`     │ Errors:   ${errors.toLocaleString()}`);
            }
            console.log(`     │ Running:  ${formatDuration(elapsed)}`);
            console.log(`     └─────────────────────────────────────────────────`);
        });
    } else {
        console.log('  ✅ No active imports running');
    }

    // ========================================================================
    // 2. Recent completed imports
    // ========================================================================
    console.log('\n📋 RECENT COMPLETED IMPORTS:');
    console.log('────────────────────────────────────────────────────────────');

    const { data: recentLogs, error: recentError } = await supabase
        .from('data_ingestion_log')
        .select('*')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(5);

    if (recentError) {
        console.log('  ⚠️  Could not query recent imports:', recentError.message);
    } else if (recentLogs && recentLogs.length > 0) {
        recentLogs.forEach((log, i) => {
            const statusIcon = log.status === 'success' ? '✅' : log.status === 'partial' ? '⚠️' : '❌';
            console.log(`  ${statusIcon} ${log.source} / ${log.table_name || log.metric_name || '(unknown)'}`);
            console.log(`     |-- Records: ${log.records_processed || 0} processed -> ${log.records_success || 0} success, ${log.records_error || 0} errors`);
            console.log(`     |-- Duration: ${log.duration_ms ? formatDuration(log.duration_ms / 1000) : 'N/A'}`);
            console.log(`     +-- Completed: ${log.completed_at}`);
        });
    } else {
        console.log('  (No recent import logs found)');
    }

    // ========================================================================
    // 3. Database table row counts
    // ========================================================================
    console.log('\n📈 DATABASE TABLE COUNTS:');
    console.log('────────────────────────────────────────────────────────────');

    const tables = [
        { name: 'markets', desc: 'Geographic regions' },
        { name: 'zillow_zhvi', desc: 'Zillow Home Value Index' },
        { name: 'zillow_zori', desc: 'Zillow Rent Index' },
        { name: 'zillow_zhvf', desc: 'Zillow Home Value Forecast' },
        { name: 'zillow_zordi', desc: 'Zillow Rent Demand Index' },
        { name: 'zillow_new_listings', desc: 'New Listings Count' },
        { name: 'zillow_pending_listings', desc: 'Pending Listings Count' },
        { name: 'zillow_median_list_price', desc: 'Median List Price' },
        { name: 'zillow_sale_to_list', desc: 'Sale-to-List Ratio' },
        { name: 'zillow_days_to_close', desc: 'Days to Close' },
        { name: 'zillow_price_cut_share', desc: 'Price Cut Share %' },
    ];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table.name)
                .select('*', { count: 'exact', head: true });

            if (!error && count !== null) {
                const countStr = count.toLocaleString().padStart(12);
                console.log(`  ${countStr} | ${table.name}`);
            } else if (error?.code === '42P01') {
                console.log(`  ${'(no table)'.padStart(12)} | ${table.name}`);
            } else {
                console.log(`  ${'(error)'.padStart(12)} | ${table.name}: ${error?.message || 'unknown'}`);
            }
        } catch (e) {
            console.log(`  ${'(error)'.padStart(12)} | ${table.name}: ${e.message}`);
        }
    }

    // ========================================================================
    // 4. Data freshness - most recent entries
    // ========================================================================
    console.log('\n📅 DATA FRESHNESS (Most Recent Entries):');
    console.log('────────────────────────────────────────────────────────────');

    // ZHVI freshness
    const { data: recentZhvi } = await supabase
        .from('zillow_zhvi')
        .select('date, created_at, geography')
        .order('created_at', { ascending: false })
        .limit(5);

    if (recentZhvi && recentZhvi.length > 0) {
        const uniqueGeos = [...new Set(recentZhvi.map(r => r.geography))];
        console.log(`  ZHVI: Last insert at ${recentZhvi[0].created_at}`);
        console.log(`        Data date: ${recentZhvi[0].date}, Geographies: ${uniqueGeos.join(', ')}`);
    }

    // ZORI freshness
    const { data: recentZori } = await supabase
        .from('zillow_zori')
        .select('date, created_at, geography')
        .order('created_at', { ascending: false })
        .limit(1);

    if (recentZori && recentZori.length > 0) {
        console.log(`  ZORI: Last insert at ${recentZori[0].created_at}, date: ${recentZori[0].date}`);
    }

    // market_time_series table has been removed (data migrated to source-specific tables)

    // ========================================================================
    // 5. Check for potential issues
    // ========================================================================
    console.log('\n⚡ POTENTIAL ISSUES:');
    console.log('────────────────────────────────────────────────────────────');

    let issuesFound = 0;

    // Check for old running imports (> 1 hour)
    if (runningLogs && runningLogs.length > 0) {
        for (const log of runningLogs) {
            if (log.started_at) {
                const elapsed = (Date.now() - new Date(log.started_at).getTime()) / 1000;
                if (elapsed > 3600) {
                    console.log(`  ⚠️  STALE: Import ${log.source}/${log.table_name} has been running for ${formatDuration(elapsed)}`);
                    console.log(`           This may be hung. Consider investigating or restarting.`);
                    issuesFound++;
                }
            }
        }
    }

    // Check for recent failures
    const { data: recentFailures } = await supabase
        .from('data_ingestion_log')
        .select('*')
        .eq('status', 'failed')
        .order('completed_at', { ascending: false })
        .limit(3);

    if (recentFailures && recentFailures.length > 0) {
        recentFailures.forEach(log => {
            console.log(`  ❌ FAILED: ${log.source}/${log.table_name} at ${log.completed_at}`);
            if (log.error_message) {
                console.log(`           Error: ${log.error_message.substring(0, 100)}...`);
            }
            issuesFound++;
        });
    }

    if (issuesFound === 0) {
        console.log('  ✅ No issues detected');
    }

    console.log('\n' + '════════════════════════════════════════════════════════════');
    console.log('Report generated at:', new Date().toISOString());
    console.log('');
}

// Run the status check
checkStatus()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error running status check:', err);
        process.exit(1);
    });
