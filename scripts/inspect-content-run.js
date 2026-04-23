#!/usr/bin/env node
// Read-only inspector for a single content-pipeline run.
// Usage: node scripts/inspect-content-run.js <runId>

const { Client } = require("pg");

const CONN =
  "postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

const runId = process.argv[2];
if (!runId) {
  console.error("usage: node inspect-content-run.js <runId>");
  process.exit(1);
}

(async () => {
  const c = new Client({
    connectionString: CONN,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const run = await c.query(
    `SELECT status, status_reason, format, approval_mode,
            resolved_geo->>'canonical_name' AS market,
            selected_platforms, tts_provider,
            to_char(created_at, 'HH24:MI:SS') AS created,
            to_char(updated_at, 'HH24:MI:SS') AS updated
       FROM content_runs WHERE id = $1`,
    [runId],
  );
  console.log("=== RUN ===");
  console.table(run.rows);

  const events = await c.query(
    `SELECT to_char(created_at, 'HH24:MI:SS.MS') AS ts, event_type, payload
       FROM content_run_events WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId],
  );
  console.log(`=== EVENTS (${events.rows.length}) ===`);
  for (const r of events.rows) {
    console.log(r.ts, r.event_type, JSON.stringify(r.payload).slice(0, 250));
  }

  const assets = await c.query(
    `SELECT kind,
            metadata->>'durationMs' AS duration_ms,
            metadata->>'synthWallMs' AS wall_ms,
            to_char(created_at, 'HH24:MI:SS') AS ts
       FROM content_assets WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId],
  );
  console.log("=== ASSETS ===");
  console.table(assets.rows);

  const gates = await c.query(
    `SELECT gate, result, to_char(created_at, 'HH24:MI:SS') AS ts, details
       FROM content_run_gates WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId],
  );
  console.log("=== GATES ===");
  for (const g of gates.rows) {
    console.log(
      g.ts,
      g.gate,
      g.result,
      JSON.stringify(g.details).slice(0, 250),
    );
  }

  const fmt = run.rows[0]?.format;
  if (fmt) {
    const ft = await c.query(
      `SELECT format, duration_seconds, natural_wpm, audio_buffer_seconds,
              (duration_seconds - audio_buffer_seconds) AS audio_budget_s
         FROM format_templates WHERE format = $1`,
      [fmt],
    );
    console.log("=== FORMAT TEMPLATE ===");
    console.table(ft.rows);
  }

  await c.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
