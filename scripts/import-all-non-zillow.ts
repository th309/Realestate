/**
 * Import All Non-Zillow Data Sources
 *
 * Runs all data import pipelines except Zillow, sequentially with error recovery.
 * Each import runs as a child process so a failure in one doesn't kill the rest.
 * All imports use --no-refresh to skip per-pipeline metric refresh; a single
 * refresh runs at the very end.
 *
 * Usage:
 *   npx tsx scripts/import-all-non-zillow.ts                    # Run all imports
 *   npx tsx scripts/import-all-non-zillow.ts --skip=redfin      # Skip specific source
 *   npx tsx scripts/import-all-non-zillow.ts --only=census,economic  # Run only specific sources
 */

import { execSync, execFileSync, ExecSyncOptions } from "child_process";
import {
  PIPELINES,
  TIMEOUTS,
  type ImportPipeline,
} from "./import-all-non-zillow.config";

interface PipelineResult {
  id: string;
  name: string;
  success: boolean;
  durationSeconds: number;
  error?: string;
}

function parseArgs(): {
  skip: Set<string>;
  only: Set<string> | null;
} {
  const args = process.argv.slice(2);
  const skip = new Set<string>();
  let only: Set<string> | null = null;

  for (const arg of args) {
    if (arg.startsWith("--skip=")) {
      arg
        .split("=")[1]
        .split(",")
        .forEach((s) => skip.add(s.trim()));
    }
    if (arg.startsWith("--only=")) {
      only = new Set(
        arg
          .split("=")[1]
          .split(",")
          .map((s) => s.trim()),
      );
    }
  }

  return { skip, only };
}

function runPipeline(pipeline: ImportPipeline): PipelineResult {
  const startTime = Date.now();
  const timeout = TIMEOUTS[pipeline.size];

  const execOpts: ExecSyncOptions = {
    stdio: "inherit",
    timeout,
    env: { ...process.env },
    maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
  };

  try {
    execSync(pipeline.command, execOpts);
    const duration = (Date.now() - startTime) / 1000;
    return {
      id: pipeline.id,
      name: pipeline.name,
      success: true,
      durationSeconds: duration,
    };
  } catch (err: any) {
    const duration = (Date.now() - startTime) / 1000;
    const isTimeout = err.killed || err.signal === "SIGTERM";
    const errorMsg = isTimeout
      ? `Timed out after ${Math.round(timeout / 1000)}s`
      : err.status
        ? `Exit code ${err.status}`
        : err.message?.substring(0, 200);

    return {
      id: pipeline.id,
      name: pipeline.name,
      success: false,
      durationSeconds: duration,
      error: errorMsg,
    };
  }
}

function runFinalMetricRefresh(): boolean {
  console.log("\n" + "=".repeat(70));
  console.log("  FINAL: Refreshing Calculated Metrics (single run)");
  console.log("=".repeat(70) + "\n");

  try {
    execFileSync("npx", ["tsx", "scripts/refresh-all-metrics.ts"], {
      stdio: "inherit",
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    });
    return true;
  } catch (err: any) {
    console.error(`  Metric refresh failed: ${err.message?.substring(0, 200)}`);
    return false;
  }
}

function main() {
  const startTime = Date.now();
  const { skip, only } = parseArgs();

  console.log("");
  console.log("=".repeat(70));
  console.log("  IMPORT ALL NON-ZILLOW DATA SOURCES");
  console.log("=".repeat(70));
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Skipping: ${skip.size > 0 ? [...skip].join(", ") : "none"}`);
  console.log(`  Only: ${only ? [...only].join(", ") : "all"}`);
  console.log(`  Mode: per-pipeline imports, single metric refresh at end`);
  console.log("=".repeat(70));

  // Filter pipelines
  const pipelinesToRun = PIPELINES.filter((p) => {
    if (skip.has(p.id)) return false;
    if (only && !only.has(p.id)) return false;
    return true;
  });

  console.log(`\nRunning ${pipelinesToRun.length} import pipeline(s):\n`);
  pipelinesToRun.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} [${p.size}]`);
  });
  console.log("");

  const results: PipelineResult[] = [];

  for (let i = 0; i < pipelinesToRun.length; i++) {
    const pipeline = pipelinesToRun[i];

    console.log("\n" + "-".repeat(70));
    console.log(`  [${i + 1}/${pipelinesToRun.length}] ${pipeline.name}`);
    console.log(`  Command: ${pipeline.command}`);
    console.log(`  Timeout: ${TIMEOUTS[pipeline.size] / 1000}s`);
    console.log("-".repeat(70) + "\n");

    const result = runPipeline(pipeline);
    results.push(result);

    const icon = result.success ? "OK" : "FAILED";
    console.log(
      `\n  >> ${icon} - ${pipeline.name} (${result.durationSeconds.toFixed(1)}s)`,
    );
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }

    // Brief pause between pipelines to let Supabase breathe
    if (i < pipelinesToRun.length - 1) {
      console.log("  Pausing 3s before next pipeline...");
      execSync("sleep 3 || timeout /t 3 >nul 2>&1", { stdio: "ignore" });
    }
  }

  // Run calculated metrics refresh once at the end
  const anySuccess = results.some((r) => r.success);
  let refreshOk = true;
  if (anySuccess) {
    refreshOk = runFinalMetricRefresh();
  }

  // Final summary
  const totalDuration = (Date.now() - startTime) / 1000;
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("\n\n" + "=".repeat(70));
  console.log("  FINAL SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total duration: ${(totalDuration / 60).toFixed(1)} minutes`);
  console.log(`  Succeeded: ${succeeded.length}/${results.length}`);
  console.log(`  Failed: ${failed.length}/${results.length}`);
  console.log(`  Metric refresh: ${refreshOk ? "OK" : "FAILED"}`);
  console.log("");

  // Table of results
  console.log("  Pipeline                              Status   Duration");
  console.log("  " + "-".repeat(60));
  for (const r of results) {
    const status = r.success ? " OK  " : "FAIL ";
    const name = r.name.padEnd(38);
    const dur = `${r.durationSeconds.toFixed(1)}s`;
    console.log(`  ${name} ${status} ${dur}`);
    if (r.error) {
      console.log(`    -> ${r.error}`);
    }
  }
  console.log("");

  if (failed.length > 0) {
    console.log("  FAILED PIPELINES:");
    for (const r of failed) {
      console.log(`    - ${r.name}: ${r.error}`);
    }
    console.log("");
    console.log(`  To retry failed pipelines:`);
    console.log(
      `    npx tsx scripts/import-all-non-zillow.ts --only=${failed.map((f) => f.id).join(",")}`,
    );
    console.log("");
  }

  console.log("=".repeat(70));

  if (failed.length > 0 || !refreshOk) {
    process.exit(1);
  }
}

main();
