#!/usr/bin/env node
/**
 * Apply content-pipeline migrations to the Supabase Postgres pooler.
 * One-off script: bypasses `supabase db push` because the remote migration
 * history is out of sync with the local directory.
 *
 * Reads each content-pipeline migration SQL file in order and executes it.
 * Idempotent: every migration uses IF NOT EXISTS and DROP POLICY IF EXISTS.
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Apply order invariants:
//   1. attribution.sql creates lead_magnet_definitions + format_magnet_bindings, so
//      it must run before any *_seed_magnets.sql.
//   2. config.sql creates format_templates (with FK to tts_voices), so it must run
//      after voices seed (otherwise the FK lookup on default_tts_voice_id fails).
//   3. seed_voices.sql before seed_formats.sql for the same FK reason.
//   4. P1 seed_magnets.sql before P2 seed_p2_magnets.sql (P2 may reference magnet
//      kinds, though currently it only adds new ones).
//   5. seed_p2_magnets.sql before seed_p2_formats_enable.sql is not required by the
//      schema, but landing the magnets first matches the user-visible order
//      (a format being "enabled" implies its lead-magnet binding already exists).
const MIGRATIONS = [
  "20260421000100_content_pipeline_core.sql",
  "20260421000200_content_pipeline_distribution.sql",
  "20260421000300_content_pipeline_attribution.sql",
  "20260421000400_content_pipeline_config.sql",
  "20260421000600_content_pipeline_seed_voices.sql",
  "20260421000500_content_pipeline_seed_formats.sql",
  "20260421000700_content_pipeline_seed_magnets.sql",
  "20260422000100_content_pipeline_seed_p2_magnets.sql",
  "20260422000200_content_pipeline_seed_p2_formats_enable.sql",
  "20260421010000_pgboss_schema_bootstrap.sql",
  "20260423000100_content_pipeline_format_pace_columns.sql",
  "20260423000200_platform_credentials.sql",
  "20260425000100_content_pipeline_archetypes.sql",
  "20260425000200_platform_app_credentials.sql",
  "20260425000300_platform_app_credentials_config.sql",
];

const CONN =
  "postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({
    connectionString: CONN,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected to pooler.");

  const migrationsDir = path.resolve(__dirname, "..", "supabase", "migrations");

  for (const file of MIGRATIONS) {
    const full = path.join(migrationsDir, file);
    if (!fs.existsSync(full)) {
      console.log(`SKIP (not found): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(full, "utf8");
    try {
      console.log(`APPLYING: ${file}`);
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`  OK`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`  FAILED: ${err.message}`);
      throw err;
    }
  }

  // Verify tables
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'content_runs','content_assets','content_run_events','content_run_gates',
        'short_links','platform_posts','content_metrics',
        'lead_magnet_definitions','format_magnet_bindings','signup_attributions','lead_magnet_deliveries',
        'tts_voices','format_templates','style_references'
      )
    ORDER BY table_name
  `);
  console.log(`\nContent-pipeline tables present: ${rows.length}/14`);
  for (const r of rows) console.log(`  - ${r.table_name}`);

  const { rows: pgbossSchema } = await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name='pgboss'`,
  );
  console.log(
    `\npgboss schema present: ${pgbossSchema.length > 0 ? "yes" : "no"}`,
  );

  const { rows: fmtRows } = await client.query(
    `SELECT format, enabled, natural_wpm, audio_buffer_seconds FROM format_templates ORDER BY format`,
  );
  console.log(`\nformat_templates rows: ${fmtRows.length}`);
  for (const r of fmtRows)
    console.log(
      `  - ${r.format}: enabled=${r.enabled} wpm=${r.natural_wpm} buffer=${r.audio_buffer_seconds}s`,
    );

  const { rows: voiceRows } = await client.query(`SELECT id FROM tts_voices`);
  console.log(`\ntts_voices rows: ${voiceRows.length}`);

  const { rows: magnetRows } = await client.query(
    `SELECT kind FROM lead_magnet_definitions`,
  );
  console.log(`lead_magnet_definitions rows: ${magnetRows.length}`);

  const { rows: bindingRows } = await client.query(
    `SELECT format, magnet_kind FROM format_magnet_bindings`,
  );
  console.log(`format_magnet_bindings rows: ${bindingRows.length}`);

  await client.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
