/**
 * Local smoke test for the content-pipeline P1 Grade Reveal happy path.
 *
 * Bootstraps the full NestJS app (which starts pg-boss workers), inserts a
 * Grade Reveal run via ContentPipelineService.createRun, then polls the run's
 * status every 3 seconds and logs each transition.
 *
 * Usage (from packages/backend/):
 *   npx ts-node --transpile-only ../../scripts/test-content-pipeline-local.ts
 *
 * Prereqs:
 *   - packages/backend/.env.local has SUPABASE_DB_URL, PLATFORM_CREDENTIALS_ENCRYPTION_KEY,
 *     SHORT_LINK_BASE_URL, EDGE_TTS_PYTHON, YOUTUBE_OAUTH_* (matching plan Task 1.1-1.32).
 *   - Python 3 + edge-tts installed locally (path in EDGE_TTS_PYTHON).
 *   - Supabase migrations already applied (14 content-pipeline tables + pgboss schema).
 *   - content-pipeline Storage bucket exists.
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../packages/backend/src/app.module";
import { ContentPipelineService } from "../packages/backend/src/content-pipeline/content-pipeline.service";
import { SupabaseService } from "../packages/backend/src/supabase/supabase.service";
import { v4 as uuid } from "uuid";

const TERMINAL_STATUSES = new Set([
  "published",
  "published_partial",
  "failed",
  "rejected",
  "ready_for_review",
]);

async function main() {
  console.log("[smoke] bootstrapping NestJS...");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const pipelineService = app.get(ContentPipelineService);
  const supabase = app.get(SupabaseService).getClient();

  console.log("[smoke] creating Grade Reveal run for Cleveland, OH...");
  const idempotencyKey = uuid();
  const created = await pipelineService.createRun({
    format: "grade_reveal",
    marketQuery: "Cleveland, OH",
    idempotencyKey,
    approvalMode: "auto",
    selectedPlatforms: [],
  } as any);
  console.log(`[smoke] run created: ${created.id}`);

  let lastStatus = "";
  const start = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;

  while (Date.now() - start < TIMEOUT_MS) {
    const { data: run, error } = await supabase
      .from("content_runs")
      .select("status, status_reason, updated_at")
      .eq("id", created.id)
      .single();
    if (error) {
      console.error("[smoke] poll error:", error.message);
      break;
    }
    if (run.status !== lastStatus) {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      console.log(
        `[smoke] ${elapsed}s : ${lastStatus || "created"} -> ${run.status}${run.status_reason ? ` (${run.status_reason})` : ""}`,
      );
      lastStatus = run.status;
    }
    if (TERMINAL_STATUSES.has(run.status)) {
      console.log("[smoke] reached terminal status.");
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const { data: finalRun } = await supabase
    .from("content_runs")
    .select("*")
    .eq("id", created.id)
    .single();
  const { data: events } = await supabase
    .from("content_run_events")
    .select("event_type, payload, created_at")
    .eq("run_id", created.id)
    .order("created_at", { ascending: true });
  const { data: assets } = await supabase
    .from("content_assets")
    .select("kind, storage_url")
    .eq("run_id", created.id)
    .order("created_at", { ascending: true });
  const { data: gates } = await supabase
    .from("content_run_gates")
    .select("gate, result, details")
    .eq("run_id", created.id)
    .order("created_at", { ascending: true });

  console.log("---");
  console.log("final run status:", finalRun?.status);
  console.log("status reason:", finalRun?.status_reason);
  console.log("costs:", JSON.stringify(finalRun?.costs, null, 2));
  console.log("events:");
  for (const e of events ?? []) {
    console.log(
      `  ${e.created_at}  ${e.event_type}  ${JSON.stringify(e.payload).slice(0, 120)}`,
    );
  }
  console.log("assets:");
  for (const a of assets ?? []) {
    console.log(`  ${a.kind}  ${a.storage_url?.slice(0, 80) ?? "(inline)"}`);
  }
  console.log("gates:");
  for (const g of gates ?? []) {
    console.log(
      `  ${g.gate}  ${g.result}  ${JSON.stringify(g.details).slice(0, 120)}`,
    );
  }

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke] FATAL:", err);
  process.exit(1);
});
