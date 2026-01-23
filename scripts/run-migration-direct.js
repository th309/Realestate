/**
 * Run migrations directly via PostgreSQL connection
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function runMigration(filePath) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Connecting to database...`);
    await client.connect();
    console.log(`Connected!`);

    console.log(`Reading migration file: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Executing migration...`);
    await client.query(sql);
    console.log(`Migration completed successfully!`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyIQ - Run Migration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const migrations = [
    'scripts/migrations/060-create-performance-tracking.sql',
    'scripts/migrations/061-propertyiq-scores-normalized.sql',
  ];

  for (const migration of migrations) {
    const filePath = path.resolve(process.cwd(), migration);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${migration}`);
      continue;
    }

    console.log(`📄 Running: ${migration}`);
    try {
      await runMigration(filePath);
      console.log(`✅ ${migration} completed`);
    } catch (error) {
      console.log(`❌ ${migration} failed: ${error.message}`);
      // Continue with next migration
    }
    console.log('');
  }

  console.log('Done!');
}

main();
