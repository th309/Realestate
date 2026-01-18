/**
 * Add income_to_buy column using the Supabase pooler
 */
import { Client } from 'pg';

const CONFIG = {
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.pysflbhpnqwoczyuaaif',
  password: 'IHatedoingpt12',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  console.log('Adding income_to_buy column via pooler...\n');

  const client = new Client(CONFIG);

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'calculated_metrics'
      AND column_name = 'income_to_buy'
    `);

    if (checkResult.rowCount && checkResult.rowCount > 0) {
      console.log('✅ Column income_to_buy already exists!');
      return;
    }

    // Add the column
    console.log('Adding income_to_buy column...');
    await client.query(`
      ALTER TABLE calculated_metrics
      ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12, 2);
    `);
    console.log('✅ Column added!');

    // Add index
    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calc_income_to_buy
      ON calculated_metrics(income_to_buy);
    `);
    console.log('✅ Index created!');

    // Add comment
    console.log('Adding column comment...');
    await client.query(`
      COMMENT ON COLUMN calculated_metrics.income_to_buy IS
      'Annual income needed to buy: (PITI × 12) / 0.28. Assumes 20% down, 30-yr fixed at FRED rate, 1.1% tax, 0.35% insurance.';
    `);
    console.log('✅ Comment added!');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('MIGRATION COMPLETE: income_to_buy column added successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nNext: Run refresh to populate data:');
    console.log('  npx tsx scripts/utils/refresh-calculated-metrics.ts');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
