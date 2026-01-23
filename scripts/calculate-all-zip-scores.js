/**
 * Calculate PropertyIQ scores for ALL ZIP codes
 *
 * Uses pagination to fetch ZIPs and batch inserts for efficiency.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPaths = [
  path.join(__dirname, '..', 'packages', 'backend', '.env'),
  path.join(__dirname, '..', '.env.local'),
];

for (const envPath of envPaths) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const eqIndex = trimmedLine.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmedLine.substring(0, eqIndex).trim();
          const value = trimmedLine.substring(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch (e) {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BATCH_SIZE = 1000;  // Supabase default limit
const INSERT_BATCH_SIZE = 500;  // Insert in smaller batches for reliability
const SCORE_DATE = '2025-12-01';

// Score calculation helpers
function zScoreToScore(z) {
  const clamped = Math.max(-3, Math.min(3, z || 0));
  return Math.round((clamped + 3) / 6 * 100 * 10) / 10;
}

function scoreToGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

async function fetchZipBatch(offset) {
  const { data, error, count } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, hotness_score, demand_score, median_listing_price, median_days_on_market, active_listing_count, pending_ratio, price_reduced_share', { count: 'exact' })
    .eq('period_date', SCORE_DATE)
    .range(offset, offset + BATCH_SIZE - 1)
    .order('postal_code');

  return { data, error, count };
}

function calculateScores(zip) {
  // Use hotness/demand if available, otherwise derive from other metrics
  let marketHealthScore, homereadyScore, investoredgeScore;
  let confidence, confidenceLevel;

  if (zip.hotness_score != null && zip.demand_score != null) {
    // Full data available - high confidence
    const hotnessZ = (zip.hotness_score - 50) / 25;
    const demandZ = (zip.demand_score - 50) / 25;

    marketHealthScore = zScoreToScore((hotnessZ + demandZ) / 2);
    homereadyScore = zScoreToScore(demandZ);
    investoredgeScore = zScoreToScore(hotnessZ);
    confidence = 70;
    confidenceLevel = 'MEDIUM';
  } else {
    // Derive scores from available metrics - lower confidence
    // Use DOM, pending_ratio, price_reduced_share as proxies
    const domZ = zip.median_days_on_market != null ? (60 - zip.median_days_on_market) / 30 : 0;  // Lower DOM = better
    const pendingZ = zip.pending_ratio != null ? (zip.pending_ratio - 0.15) / 0.1 : 0;  // Higher = better demand
    const priceReducedZ = zip.price_reduced_share != null ? (0.20 - zip.price_reduced_share) / 0.1 : 0;  // Lower = better

    // Combine available signals
    const availableSignals = [domZ, pendingZ, priceReducedZ].filter(z => z !== 0);
    const avgZ = availableSignals.length > 0 ? availableSignals.reduce((a, b) => a + b, 0) / availableSignals.length : 0;

    marketHealthScore = zScoreToScore(avgZ);
    homereadyScore = zScoreToScore(avgZ * 0.9);  // Slightly lower for derived
    investoredgeScore = zScoreToScore(avgZ * 0.8);
    confidence = 40 + (availableSignals.length * 10);  // Lower confidence for derived scores
    confidenceLevel = 'LOW';
  }

  return [
    {
      geography: 'zip',
      location_id: zip.postal_code,
      location_name: zip.zip_name,
      score_type: 'markethealth',
      score: marketHealthScore,
      grade: scoreToGrade(marketHealthScore),
      confidence: confidence,
      confidence_level: confidenceLevel,
      median_price: zip.median_listing_price,
      score_date: SCORE_DATE,
    },
    {
      geography: 'zip',
      location_id: zip.postal_code,
      location_name: zip.zip_name,
      score_type: 'homeready',
      score: homereadyScore,
      grade: scoreToGrade(homereadyScore),
      confidence: confidence,
      confidence_level: confidenceLevel,
      median_price: zip.median_listing_price,
      score_date: SCORE_DATE,
    },
    {
      geography: 'zip',
      location_id: zip.postal_code,
      location_name: zip.zip_name,
      score_type: 'investoredge',
      score: investoredgeScore,
      grade: scoreToGrade(investoredgeScore),
      confidence: confidence,
      confidence_level: confidenceLevel,
      median_price: zip.median_listing_price,
      score_date: SCORE_DATE,
    },
  ];
}

async function insertBatch(records) {
  const { error } = await supabase
    .from('propertyiq_scores')
    .upsert(records, { onConflict: 'geography,location_id,score_type,score_date' });

  return error;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Calculate PropertyIQ Scores for ALL ZIPs');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();

  // Get total count first
  const { count: totalZips } = await fetchZipBatch(0);
  console.log(`Total ZIPs with scoring data: ${totalZips}`);
  console.log(`Batch size: ${BATCH_SIZE} ZIPs, Insert batch: ${INSERT_BATCH_SIZE} records`);
  console.log('');

  let processed = 0;
  let inserted = 0;
  let errors = 0;
  let offset = 0;

  while (offset < totalZips) {
    // Fetch batch of ZIPs
    const { data: zips, error: fetchError } = await fetchZipBatch(offset);

    if (fetchError) {
      console.log(`ERROR fetching at offset ${offset}:`, fetchError.message);
      errors++;
      offset += BATCH_SIZE;
      continue;
    }

    if (!zips || zips.length === 0) break;

    // Calculate scores for all ZIPs in batch
    const allScores = [];
    for (const zip of zips) {
      const scores = calculateScores(zip);
      allScores.push(...scores);
    }

    // Insert in smaller batches
    for (let i = 0; i < allScores.length; i += INSERT_BATCH_SIZE) {
      const batch = allScores.slice(i, i + INSERT_BATCH_SIZE);
      const insertError = await insertBatch(batch);

      if (insertError) {
        console.log(`ERROR inserting batch:`, insertError.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    processed += zips.length;
    offset += BATCH_SIZE;

    // Progress update
    const pct = Math.round(processed / totalZips * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\rProcessed: ${processed}/${totalZips} (${pct}%) | Inserted: ${inserted} | Errors: ${errors} | Time: ${elapsed}s`);
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`ZIPs processed: ${processed}`);
  console.log(`Scores inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch(console.error);
