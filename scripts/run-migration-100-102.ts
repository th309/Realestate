/**
 * Run entitlements migrations (100, 101, 102)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function runMigration(filePath: string): Promise<void> {
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
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    throw error;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyIQ - Run Entitlements Migrations (100, 101, 102)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const migrations = [
    'scripts/migrations/100-add-resource-gating-features.sql',
    'scripts/migrations/101-create-paywall-events-table.sql',
    'scripts/migrations/102-create-trial-tables.sql',
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
    } catch (error: any) {
      console.log(`❌ ${migration} failed: ${error.message}`);
    }
    console.log('');
  }

  console.log('Done!');
}

main();
