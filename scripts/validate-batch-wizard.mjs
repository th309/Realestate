#!/usr/bin/env node
/**
 * Destination-gate validation for the batch wizard.
 *
 * 1. Sign in to Supabase directly to get a JWT (the frontend uses
 *    @supabase/ssr which stores the session in cookies — easier to skip
 *    the browser and call the auth API directly)
 * 2. Use JWT to call backend APIs:
 *      - POST /runs        (single-mode equivalent — Austin metro)
 *      - POST /runs/batch  (batch with 2 zips: 78704, 90210)
 * 3. Poll /runs/:id until published or timeout
 * 4. Verify each run has a YouTube public URL
 *
 * Run: node scripts/validate-batch-wizard.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const FRONTEND = "http://localhost:3000";
const BACKEND = "http://localhost:3001";
const SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_61DKKthHAcJj0Db81Nj9XA_x25bcXqZ";
const EMAIL = "troy@propertyiq.app";
const PASSWORD = "Youknowwhy$$12";

const PER_RUN_TIMEOUT_MS = 25 * 60 * 1000; // 25 min/run
const POLL_INTERVAL_MS = 15_000;
void FRONTEND;

async function getJwt() {
  console.log("== Signing in to Supabase ==");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw new Error(`signInWithPassword: ${error.message}`);
  if (!data?.session?.access_token)
    throw new Error("signin returned no access_token");
  console.log(`  got JWT (${data.session.access_token.length} chars)`);
  return data.session.access_token;
}

async function createSingleRun(jwt) {
  console.log("== Creating single-mode run (Austin metro) ==");
  const res = await fetch(`${BACKEND}/api/admin/content-pipeline/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      format: "grade_reveal",
      marketQuery: "Austin",
      idempotencyKey: randomUUID(),
      approvalMode: "auto",
      selectedPlatforms: ["youtube_shorts"],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createRun ${res.status}: ${body}`);
  }
  const json = await res.json();
  console.log(`  singleRunId=${json.data.id}`);
  return json.data.id;
}

async function createBatchRun(jwt) {
  console.log("== Creating batch run (zips 78704, 90210) ==");
  const res = await fetch(`${BACKEND}/api/admin/content-pipeline/runs/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      format: "grade_reveal",
      markets: [
        { id: "78704", geography: "zip" },
        { id: "90210", geography: "zip" },
      ],
      approvalMode: "auto",
      platforms: ["youtube_shorts"],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createBatchRuns ${res.status}: ${body}`);
  }
  const json = await res.json();
  console.log(
    `  batchId=${json.data.batchId}, runs=[${json.data.runIds.join(", ")}], created=${json.data.created}, failed=${json.data.failed}`,
  );
  if (json.data.errors) console.log("  errors:", json.data.errors);
  if (json.data.created !== 2) {
    throw new Error(
      `expected 2 batch runs created, got ${json.data.created} (failed=${json.data.failed})`,
    );
  }
  return { batchId: json.data.batchId, runIds: json.data.runIds };
}

async function pollUntilPublished(jwt, runId) {
  const start = Date.now();
  let lastStatus = "";
  while (Date.now() - start < PER_RUN_TIMEOUT_MS) {
    const res = await fetch(
      `${BACKEND}/api/admin/content-pipeline/runs/${runId}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    if (!res.ok) {
      console.log(`  ${runId}: HTTP ${res.status} — retrying`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const json = await res.json();
    const data = json.data;
    const status = data?.status ?? "unknown";
    if (status !== lastStatus) {
      console.log(`  ${runId}: ${status}`);
      lastStatus = status;
    }
    if (status === "published" || status === "published_partial") {
      return data;
    }
    if (status === "failed" || status === "rejected") {
      throw new Error(
        `run ${runId} terminated as ${status}: ${data?.failure_reason ?? "unknown"}`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `run ${runId} did not publish within ${PER_RUN_TIMEOUT_MS / 1000}s`,
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const jwt = await getJwt();

  const singleRunId = await createSingleRun(jwt);
  const { batchId, runIds: batchRunIds } = await createBatchRun(jwt);

  const allRunIds = [singleRunId, ...batchRunIds];
  console.log(
    `\n== Polling ${allRunIds.length} runs to publication (timeout ${PER_RUN_TIMEOUT_MS / 1000}s/run) ==`,
  );

  const results = [];
  for (const id of allRunIds) {
    const data = await pollUntilPublished(jwt, id);
    const ytPost = (data.platform_posts ?? []).find(
      (p) => p.platform === "youtube_shorts",
    );
    if (!ytPost) {
      throw new Error(`run ${id} published but has no youtube_shorts post`);
    }
    const ytUrl = ytPost.public_url ?? ytPost.platform_post_id;
    if (!ytUrl) {
      throw new Error(`run ${id} youtube post has no public_url`);
    }
    console.log(`  OK ${id} -> ${ytUrl}`);
    results.push({ runId: id, youtubeUrl: ytUrl });
  }

  console.log(`\n== ALL ${results.length} VIDEOS LIVE ==`);
  console.log(`Batch ID: ${batchId}`);
  for (const r of results) console.log(`  ${r.runId}: ${r.youtubeUrl}`);
}

main().catch((err) => {
  console.error("\nVALIDATION FAILED:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
