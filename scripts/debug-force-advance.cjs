const { Client } = require('pg');
const PgBoss = require('pg-boss');
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env.local') });

const runId = process.argv[2];
const toStatus = process.argv[3];
const queueName = process.argv[4];

if (!runId || !toStatus || !queueName) {
  console.error('usage: node debug-force-advance.cjs <runId> <toStatus> <queueName>');
  process.exit(1);
}

(async () => {
  const c = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Confirm the asset actually exists before advancing
  const asset = await c.query(
    `SELECT kind, storage_url FROM content_assets WHERE run_id=$1 ORDER BY created_at DESC`,
    [runId]
  );
  console.log('ASSETS:', asset.rows);

  const run = await c.query(`SELECT status FROM content_runs WHERE id=$1`, [runId]);
  console.log('CURRENT STATUS:', run.rows[0]?.status);

  await c.query(
    `UPDATE content_runs SET status=$1, status_reason='force-advanced (backend restart mid-transition)', updated_at=NOW() WHERE id=$2`,
    [toStatus, runId]
  );
  await c.query(
    `INSERT INTO content_run_events (run_id, event_type, payload) VALUES ($1, 'status_changed', $2::jsonb)`,
    [runId, JSON.stringify({ from: run.rows[0]?.status, to: toStatus, reason: 'force-advanced' })]
  );
  console.log('advanced content_runs →', toStatus);

  await c.end();

  const schema = process.env.PGBOSS_SCHEMA ?? 'pgboss';
  const boss = new PgBoss({
    connectionString: process.env.SUPABASE_DB_URL,
    schema,
    retryLimit: 0,
  });
  await boss.start();
  const jobId = await boss.send(queueName, { runId, status: toStatus });
  console.log('enqueued', queueName, 'jobId=', jobId, 'schema=', schema);
  await boss.stop({ graceful: true });
})().catch((e) => { console.error(e); process.exit(1); });
