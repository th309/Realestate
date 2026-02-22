/**
 * Benchmark Batch Size
 * 
 * Runs a sample import with different batch sizes to determine the most efficient one.
 * Uses a subset of data to avoid long runtimes.
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const BATCH_SIZES = [100, 500, 1000, 2000, 5000];
const SAMPLE_SIZE = 1000;

async function runBenchmark() {
    console.log('🚀 Starting Batch Size Benchmark');
    console.log('===============================');
    console.log(`Sample Size: ${SAMPLE_SIZE} records per run`);
    console.log(`Batch Sizes to test: ${BATCH_SIZES.join(', ')}`);
    console.log('');

    const results: any[] = [];

    for (const batchSize of BATCH_SIZES) {
        console.log(`\n🧪 Testing Batch Size: ${batchSize}`);

        // Realtor ZIP is faster for benchmarking as it doesn't need geoid lookups
        const realtorCmd = `npx tsx scripts/import-realtor-zip.ts --history --limit=${SAMPLE_SIZE} --batch=${batchSize} --no-refresh`;

        const startTime = Date.now();
        try {
            execSync(realtorCmd, { stdio: 'inherit' });
            const duration = (Date.now() - startTime) / 1000;
            const recordsPerSecond = SAMPLE_SIZE / duration;

            results.push({
                batchSize,
                duration: duration.toFixed(2),
                rps: recordsPerSecond.toFixed(2)
            });

            console.log(`✅ Completed in ${duration.toFixed(2)}s (${recordsPerSecond.toFixed(2)} rec/s)`);
        } catch (error: any) {
            console.error(`❌ Failed for batch size ${batchSize}: ${error.message}`);
        }
    }

    console.log('\n📊 BENCHMARK RESULTS');
    console.log('====================');
    console.table(results);

    const best = results.reduce((prev, current) => (parseFloat(prev.rps) > parseFloat(current.rps)) ? prev : current);
    console.log(`\n🏆 Optimal Batch Size: ${best.batchSize} (${best.rps} rec/s)`);
}

runBenchmark().catch(console.error);
