/**
 * Verify entitlements migrations
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function verify() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database\n');

  // Check feature definitions
  const features = await client.query("SELECT category, COUNT(*) FROM feature_definitions GROUP BY category ORDER BY category");
  console.log('Feature definitions by category:');
  features.rows.forEach((r: any) => console.log('  ', r.category, ':', r.count));

  // Check paywall_events table exists
  const paywall = await client.query("SELECT COUNT(*) FROM paywall_events");
  console.log('\nPaywall events table created:', paywall.rows[0].count, 'rows');

  // Check trial tables
  const trial = await client.query("SELECT * FROM trial_config");
  console.log('\nTrial config:');
  console.log('  enabled:', trial.rows[0]?.is_enabled);
  console.log('  duration_days:', trial.rows[0]?.duration_days);
  console.log('  trial_tier:', trial.rows[0]?.trial_tier);

  // Check user_trials table exists
  const userTrials = await client.query("SELECT COUNT(*) FROM user_trials");
  console.log('\nUser trials table created:', userTrials.rows[0].count, 'rows');

  // Check tier features
  const tierFeatures = await client.query(`
    SELECT st.slug as tier, COUNT(*) as features
    FROM tier_features tf
    JOIN subscription_tiers st ON tf.tier_id = st.id
    GROUP BY st.slug
    ORDER BY st.slug
  `);
  console.log('\nTier features by tier:');
  tierFeatures.rows.forEach((r: any) => console.log('  ', r.tier, ':', r.features));

  await client.end();
}

verify().catch(console.error);
