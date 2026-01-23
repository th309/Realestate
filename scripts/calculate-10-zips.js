/**
 * Calculate scores for 10 ZIP codes as a quick test
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

// Simple z-score to 0-100 conversion
function zScoreToScore(z) {
  // Clamp z-score to reasonable range (-3 to 3)
  const clamped = Math.max(-3, Math.min(3, z || 0));
  // Convert to 0-100 scale (z=0 -> 50, z=3 -> 100, z=-3 -> 0)
  return Math.round((clamped + 3) / 6 * 100);
}

function scoreToGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

async function calculate10Zips() {
  console.log('=== Calculate 10 ZIP Scores ===\n');

  // Fetch 10 ZIPs with data
  const { data: zips, error: fetchError } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, hotness_score, demand_score, median_listing_price')
    .eq('period_date', '2025-12-01')
    .not('hotness_score', 'is', null)
    .not('demand_score', 'is', null)
    .limit(10);

  if (fetchError) {
    console.log('Fetch error:', fetchError);
    return;
  }

  console.log('Found', zips.length, 'ZIPs with data\n');

  // Calculate simple scores for each ZIP
  let success = 0;
  let errors = 0;

  for (const zip of zips) {
    console.log('Processing:', zip.postal_code, '-', zip.zip_name);

    // Simple score calculation based on available metrics
    const hotnessZ = (zip.hotness_score - 50) / 25; // Normalize around 50
    const demandZ = (zip.demand_score - 50) / 25;

    const scores = {
      markethealth: zScoreToScore((hotnessZ + demandZ) / 2),
      homeready: zScoreToScore(demandZ),
      investoredge: zScoreToScore(hotnessZ),
    };

    // Insert all 3 score types
    for (const [scoreType, score] of Object.entries(scores)) {
      const record = {
        geography: 'zip',
        location_id: zip.postal_code,
        location_name: zip.zip_name,
        score_type: scoreType,
        score: score,
        grade: scoreToGrade(score),
        confidence: 70,
        confidence_level: 'MEDIUM',
        median_price: zip.median_listing_price,
        score_date: '2025-12-01',
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('propertyiq_scores_v2')
        .upsert(record, { onConflict: 'geography,location_id,score_type,score_date' });

      if (insertError) {
        console.log('  ERROR:', scoreType, '-', insertError.message);
        errors++;
      } else {
        console.log('  OK:', scoreType, '=', score, '(' + scoreToGrade(score) + ')');
        success++;
      }
    }
  }

  console.log('\n=== Results ===');
  console.log('Success:', success);
  console.log('Errors:', errors);

  // Verify by reading back
  console.log('\n=== Verification ===');
  const { data: check, error: checkError } = await supabase
    .from('propertyiq_scores_v2')
    .select('location_id, location_name, score_type, score, grade')
    .eq('geography', 'zip')
    .eq('score_date', '2025-12-01')
    .limit(15);

  if (checkError) {
    console.log('Check error:', checkError);
  } else {
    console.log('ZIP scores in database:');
    check.forEach(r => console.log(' ', r.location_id, '-', r.score_type + ':', r.score, '(' + r.grade + ')'));
  }
}

calculate10Zips().catch(console.error);
