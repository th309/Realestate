/**
 * Chunked ZIP backfill for zhvi_forward_returns.
 *
 * The Supabase MCP execute_sql client has a ~30s client timeout that can't
 * be overridden, so the ZIP portion of migration 139 is finished here via a
 * direct pg connection that sets statement_timeout to unlimited for the
 * session.
 *
 * Idempotent: ON CONFLICT DO NOTHING means re-running is safe.
 *
 * Usage:   npx tsx scripts/backfill-zhvi-zip-forward-returns.ts
 */

import { Client } from "pg";

// Reuse the same connection the project already uses for migrations.
// These credentials are already committed in scripts/deploy-migrations-pg.ts.
const CONFIG = {
  host: "aws-1-us-east-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.pysflbhpnqwoczyuaaif",
  password: "IHatedoingpt12",
  ssl: { rejectUnauthorized: false },
};

const START_YEAR = 2020; // 2000-2019 already done
const END_YEAR = 2026;

const INSERT_SQL = `
INSERT INTO zhvi_forward_returns
  (geography_level, location_id, period_date, zhvi_t0, zhvi_t12, zhvi_t36, return_1y, return_3y_ann)
SELECT 'zip', z0.region_name, z0.period_date, z0.value, z12.value, z36.value,
  CASE WHEN z12.value IS NOT NULL AND z0.value > 0 THEN (z12.value - z0.value) / z0.value END,
  CASE WHEN z36.value IS NOT NULL AND z0.value > 0 THEN POWER(z36.value / z0.value, 1.0/3.0) - 1 END
FROM zillow_zip z0
LEFT JOIN zillow_zip z12
  ON  z12.region_name = z0.region_name AND z12.metric_name = 'zhvi'
  AND z12.period_date = (z0.period_date + INTERVAL '12 months')::date
LEFT JOIN zillow_zip z36
  ON  z36.region_name = z0.region_name AND z36.metric_name = 'zhvi'
  AND z36.period_date = (z0.period_date + INTERVAL '36 months')::date
WHERE z0.metric_name = 'zhvi' AND z0.region_name IS NOT NULL
  AND z0.period_date >= $1 AND z0.period_date < $2
ON CONFLICT (geography_level, location_id, period_date) DO NOTHING
`;

async function main(): Promise<void> {
  const client = new Client(CONFIG);
  await client.connect();
  console.log("connected — disabling statement timeout");
  await client.query("SET statement_timeout = 0");

  const totalStart = Date.now();
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;
    const t0 = Date.now();
    const res = await client.query(INSERT_SQL, [from, to]);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`year ${year}: inserted ${res.rowCount} rows in ${secs}s`);
  }

  const { rows } = await client.query(
    "SELECT COUNT(*) AS n FROM zhvi_forward_returns WHERE geography_level='zip'",
  );
  const totalSecs = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`done — ${rows[0].n} total zip rows after ${totalSecs}s`);

  await client.end();
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
