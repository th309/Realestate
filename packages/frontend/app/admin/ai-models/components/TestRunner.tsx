/**
 * Test Runner
 *
 * Automated model evaluation batch runner. Cycles through models,
 * switches configs, generates reports, and polls for completion.
 * User only needs to read reports and score them afterward.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuthState } from "@/lib/auth/useAuth";
import {
  updateAiModelConfig,
  setTestRunId,
} from "@/lib/data/fetchers/ai-models";
import { generateReport, fetchReport } from "@/lib/data/fetchers/reports";
import {
  TEST_MODELS,
  buildPhase1Jobs,
  buildPhase2Jobs,
  type TestJob,
} from "./test-runner-config";
import { TestJobTable } from "./TestJobTable";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000; // 5 min max per report

export function TestRunner({
  onBatchComplete,
}: {
  onBatchComplete?: () => void;
}) {
  const { user } = useAuthState();
  const [phase, setPhase] = useState<1 | 2>(1);
  const [jobs, setJobs] = useState<TestJob[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const abortRef = useRef(false);
  const restoredRef = useRef(false);

  // Restore jobs from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("test-runner-jobs");
      if (saved) setJobs(JSON.parse(saved));
    } catch {
      /* ignore corrupt data */
    }
    restoredRef.current = true;
  }, []);

  // Persist jobs to localStorage on change (only after initial restore)
  useEffect(() => {
    if (!restoredRef.current) return;
    if (jobs.length > 0) {
      localStorage.setItem("test-runner-jobs", JSON.stringify(jobs));
    } else {
      localStorage.removeItem("test-runner-jobs");
    }
  }, [jobs]);

  // Phase 2: model selection
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runJobs = useCallback(
    async (jobList: TestJob[], startFrom: number) => {
      if (!user) return;
      abortRef.current = false;
      setRunning(true);

      let consecutiveFailures = 0;
      for (let i = startFrom; i < jobList.length; i++) {
        if (abortRef.current) break;

        const job = jobList[i];

        // Skip jobs that already completed successfully
        if (job.status === "done") continue;

        // Abort if 3+ consecutive failures (likely a systemic issue)
        if (consecutiveFailures >= 3) break;

        setCurrentIdx(i);
        const update = (patch: Partial<TestJob>) => {
          setJobs((prev) =>
            prev.map((j, idx) => (idx === i ? { ...j, ...patch } : j)),
          );
        };

        try {
          // 1. Switch model config
          update({ status: "switching" });
          const r1 = await updateAiModelConfig("report_narrative", {
            provider: job.model.provider,
            model: job.model.model,
          } as any);
          if (!r1)
            throw new Error(
              `Failed to switch report_narrative to ${job.model.shortName}`,
            );
          const r2 = await updateAiModelConfig("report_outline", {
            provider: job.model.provider,
            model: job.model.model,
          } as any);
          if (!r2)
            throw new Error(
              `Failed to switch report_outline to ${job.model.shortName}`,
            );

          // 2. Set test run ID
          await setTestRunId(job.testRunId);

          if (abortRef.current) break;

          // 3. Generate report
          update({ status: "generating" });
          const genStart = Date.now();
          const result = await generateReport(job.request, {
            userId: user.id,
            userTier: "enterprise",
          });

          update({
            status: "polling",
            reportId: result.report_id,
            elapsed: "0s",
          });

          // 4. Poll until complete
          const pollStart = Date.now();
          let complete = false;
          while (!complete && !abortRef.current) {
            if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
              throw new Error("Report generation timed out (5 min)");
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            const report = await fetchReport<any>(result.report_id, {
              userId: user.id,
            });
            const elapsedSec = Math.round((Date.now() - pollStart) / 1000);
            const stage =
              report?.generation_stage_detail || report?.generation_stage || "";
            update({
              status: "polling",
              elapsed: `${elapsedSec}s`,
              stage: stage ? String(stage) : undefined,
            });
            if (
              report?.status === "ready" ||
              report?.status === "complete" ||
              report?.status === "completed"
            ) {
              complete = true;
            } else if (
              report?.status === "error" ||
              report?.status === "failed"
            ) {
              throw new Error("Report generation failed on backend");
            }
          }

          const generationTimeSec = Math.round((Date.now() - genStart) / 1000);
          update({
            status: "done",
            generationTimeSec,
            elapsed: `${generationTimeSec}s`,
          });
          consecutiveFailures = 0;
        } catch (err: any) {
          update({ status: "error", error: err.message });
          consecutiveFailures++;
        }
      }

      // Clear test run ID after batch
      await setTestRunId(null);
      setRunning(false);
      setCurrentIdx(-1);
      onBatchComplete?.();
    },
    [user, onBatchComplete],
  );

  const startBatch = useCallback(async () => {
    const jobList =
      phase === 1 ? buildPhase1Jobs() : buildPhase2Jobs([...selectedModels]);
    if (jobList.length === 0) return;
    setJobs(jobList);
    await runJobs(jobList, 0);
  }, [phase, selectedModels, runJobs]);

  const resumeBatch = useCallback(async () => {
    // Reset errored jobs back to pending so they get retried
    const resetJobs = jobs.map((j) =>
      j.status === "error"
        ? {
            ...j,
            status: "pending" as const,
            error: undefined,
            elapsed: undefined,
            stage: undefined,
          }
        : j,
    );
    setJobs(resetJobs);

    const firstIncomplete = resetJobs.findIndex((j) => j.status === "pending");
    if (firstIncomplete === -1) return;
    await runJobs(resetJobs, firstIncomplete);
  }, [jobs, runJobs]);

  const stopBatch = () => {
    abortRef.current = true;
  };

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;
  const progress = jobs.length > 0 ? (doneCount + errorCount) / jobs.length : 0;

  return (
    <section className="mt-8 border-t border-outline-variant pt-8">
      <h2 className="text-xl font-semibold text-on-surface mb-1">
        Run Test Batch
      </h2>
      <p className="text-sm text-on-surface-variant mb-4">
        Automatically cycles through models, generates reports, and tracks
        usage. You just read and score afterward.
      </p>

      {/* Phase selector */}
      {!running && jobs.length === 0 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setPhase(1)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                phase === 1
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              Phase 1: Elimination (7 reports)
            </button>
            <button
              onClick={() => setPhase(2)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                phase === 2
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              Phase 2: Deep Compare
            </button>
          </div>

          {/* Phase 2 model selection */}
          {phase === 2 && (
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant">
              <p className="text-xs text-on-surface-variant mb-3">
                Select models that advanced from Phase 1 ({selectedModels.size}{" "}
                selected ×4 types ×3 geos ={" "}
                <strong>{selectedModels.size * 12} reports</strong>)
              </p>
              <div className="flex flex-wrap gap-2">
                {TEST_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      selectedModels.has(m.id)
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container"
                    }`}
                  >
                    {m.shortName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startBatch}
            disabled={!user || (phase === 2 && selectedModels.size === 0)}
            className="px-6 py-2.5 text-sm font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 transition-colors duration-200"
          >
            Run {phase === 1 ? "Phase 1" : "Phase 2"} (
            {phase === 1 ? 7 : selectedModels.size * 12} reports)
          </button>
        </div>
      )}

      {/* Progress */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant whitespace-nowrap">
              {doneCount}/{jobs.length} done
              {errorCount > 0 && `, ${errorCount} errors`}
            </span>
            {running && (
              <button
                onClick={stopBatch}
                className="px-3 py-1 text-xs font-medium rounded-full bg-error-container text-on-error-container hover:bg-error-container/80"
              >
                Stop
              </button>
            )}
            {!running && (
              <div className="flex gap-2">
                {jobs.some((j) => j.status !== "done") && (
                  <button
                    onClick={resumeBatch}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90"
                  >
                    Resume ({jobs.filter((j) => j.status !== "done").length}{" "}
                    remaining)
                  </button>
                )}
                <button
                  onClick={() => {
                    setJobs([]);
                    setCurrentIdx(-1);
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <TestJobTable jobs={jobs} currentIdx={currentIdx} />
        </div>
      )}
    </section>
  );
}
