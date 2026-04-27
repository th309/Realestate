#!/usr/bin/env node
/**
 * Read-only verification that content-pipeline migrations have been applied.
 * Loads SUPABASE_DB_URL from env or packages/backend/.env.local (never printed).
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

function loadDotenvFallback() {
  const candidates = [
    path.resolve(__dirname, "..", "packages", "backend", ".env.local"),
    path.resolve(__dirname, "..", "packages", "backend", ".env"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#][^=]*)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
    break;
  }
}

const REQUIRED_TABLES = [
  "content_runs",
  "content_assets",
  "content_run_events",
  "content_run_gates",
  "short_links",
  "platform_posts",
  "content_metrics",
  "lead_magnet_definitions",
  "format_magnet_bindings",
  "signup_attributions",
  "lead_magnet_deliveries",
  "tts_voices",
  "format_templates",
  "style_references",
  "platform_credentials",
  "transcript_cache",
  "archetype_clusters",
  "script_archetypes",
  "archetype_refresh_runs",
  "platform_app_credentials",
];

async function main() {
  loadDotenvFallback();
  const conn =
    process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? null;
  if (!conn || typeof conn !== "string") {
    console.error(
      "FATAL: Set SUPABASE_DB_URL or DATABASE_URL, or configure packages/backend/.env.local.",
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const checks = [];

  const { rows: pgBoss } = await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss'`,
  );
  checks.push({
    name: "pgboss schema exists",
    ok: pgBoss.length > 0,
    detail: pgBoss.length ? "yes" : "missing",
  });

  const placeholders = REQUIRED_TABLES.map((_, i) => `$${i + 1}`).join(",");
  const { rows: tblRows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN (${placeholders})`,
    REQUIRED_TABLES,
  );
  const found = new Set(tblRows.map((r) => r.table_name));
  const missingTables = REQUIRED_TABLES.filter((t) => !found.has(t));
  checks.push({
    name: "required public tables",
    ok: missingTables.length === 0,
    detail:
      missingTables.length === 0
        ? `${found.size}/${REQUIRED_TABLES.length}`
        : `missing: ${missingTables.join(", ")}`,
  });

  const { rows: nullable } = await client.query(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_assets'
      AND column_name = 'run_id'
  `);
  const runIdNullable =
    nullable.length === 1 && nullable[0].is_nullable === "YES";
  checks.push({
    name: "content_assets.run_id nullable (lead-magnet PDFs)",
    ok: runIdNullable,
    detail: nullable.length ? nullable[0].is_nullable : "column missing",
  });

  const { rows: ftCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'format_templates'
      AND column_name IN ('natural_wpm','audio_buffer_seconds')
  `);
  const paceCols = new Set(ftCols.map((r) => r.column_name));
  checks.push({
    name: "format_templates pace columns",
    ok:
      paceCols.has("natural_wpm") && paceCols.has("audio_buffer_seconds"),
    detail: [...paceCols].sort().join(", ") || "none",
  });

  const { rows: crCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_runs'
      AND column_name IN ('batch_id','format_options')
  `);
  const crSet = new Set(crCols.map((r) => r.column_name));
  checks.push({
    name: "content_runs batch_id / format_options",
    ok: crSet.has("batch_id") && crSet.has("format_options"),
    detail: [...crSet].sort().join(", ") || "missing",
  });

  await client.end();

  console.log("\nContent-pipeline migration verification\n");
  let allOk = true;
  for (const c of checks) {
    const status = c.ok ? "PASS" : "FAIL";
    if (!c.ok) allOk = false;
    console.log(`  [${status}] ${c.name}`);
    console.log(`          ${c.detail}`);
  }
  console.log("");
  if (!allOk) {
    console.error(
      "Some checks failed — run: node scripts/apply-content-pipeline-migrations.js",
    );
    process.exit(1);
  }
  console.log("All checks passed.\n");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
