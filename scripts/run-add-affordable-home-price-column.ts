/**
 * Add affordable_home_price column using the Supabase pooler
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
  console.log('Adding affordable_home_price column via pooler...\n');

  const client = new Client(CONFIG);

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'calculated_metrics'
      AND column_name = 'affordable_home_price'
    `);

    if (checkResult.rowCount && checkResult.rowCount > 0) {
      console.log('✅ Column affordable_home_price already exists!');
      return;
    }

    // Add the column
    console.log('Adding affordable_home_price column...');
    await client.query(`
      ALTER TABLE calculated_metrics
      ADD COLUMN IF NOT EXISTS affordable_home_price DECIMAL(12, 2);
    `);
    console.log('✅ Column added!');

    // Add index
    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calc_affordable_home_price
      ON calculated_metrics(affordable_home_price);
    `);
    console.log('✅ Index created!');

    // Add comment
    console.log('Adding column comment...');
    await client.query(`
      COMMENT ON COLUMN calculated_metrics.affordable_home_price IS
      'Max home price affordable: Based on median income, 28% DTI, current mortgage rates, 20% down, 1.1% tax, 0.35% insurance.';
    `);
    console.log('✅ Comment added!');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('MIGRATION COMPLETE: affordable_home_price column added successfully!');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
