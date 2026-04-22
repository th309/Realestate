const { Client } = require('pg');
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env.local') });

const jobId = process.argv[2] || '2719a804-a66b-4fc1-8e93-87d51030d788';
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const j = await c.query(`SELECT * FROM pgboss.job WHERE id=$1`, [jobId]);
  console.log('JOB FULL:', JSON.stringify(j.rows[0], null, 2));

  // pg-boss v10 dead-letter / archive tables
  const dl = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='pgboss' AND (table_name ILIKE '%dead%' OR table_name ILIKE '%archive%' OR table_name ILIKE '%queue%')
  `);
  console.log('PGBOSS TABLES:', dl.rows);

  // Try archive if present
  try {
    const arc = await c.query(`SELECT state, output, created_on, completed_on FROM pgboss.archive WHERE data->>'runId' = $1 ORDER BY created_on DESC LIMIT 5`, ['16f4ba68-637e-4164-b9ce-a2f3e146ae46']);
    console.log('ARCHIVE:', JSON.stringify(arc.rows, null, 2));
  } catch (e) { console.log('archive not present:', e.message); }

  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
