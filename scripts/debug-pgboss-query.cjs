const { Client } = require('pg');
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env.local') });

const runId = process.argv[2] || '16f4ba68-637e-4164-b9ce-a2f3e146ae46';
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const run = await c.query(
    `SELECT id, status, status_reason, updated_at FROM content_runs WHERE id=$1`,
    [runId]
  );
  console.log('RUN:', JSON.stringify(run.rows[0], null, 2));

  const events = await c.query(
    `SELECT event_type, payload, created_at FROM content_run_events WHERE run_id=$1 ORDER BY created_at DESC LIMIT 5`,
    [runId]
  );
  console.log('EVENTS:', JSON.stringify(events.rows, null, 2));

  const jobs = await c.query(
    `SELECT id, name, state, retry_count, created_on, started_on, completed_on, data->>'runId' as runId, data->>'status' as status
     FROM pgboss.job
     WHERE data->>'runId' = $1
     ORDER BY created_on DESC
     LIMIT 10`,
    [runId]
  );
  console.log('PGBOSS JOBS:', JSON.stringify(jobs.rows, null, 2));

  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
