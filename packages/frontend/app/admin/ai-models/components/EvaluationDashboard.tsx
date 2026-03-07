/**
 * Model Evaluation Dashboard
 *
 * Shows usage log summaries, lets you score test runs on quality dimensions,
 * and displays combined composite scores for model comparison.
 * Rendered at the bottom of the AI Model Config admin page.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUsageSummary,
  fetchEvaluationScores,
  upsertEvaluationScore,
  deleteEvaluationScore,
  clearAllTestData,
  type UsageSummary,
  type EvaluationScore,
} from "@/lib/data/fetchers/ai-models";
import { UsageSummaryTable } from "./UsageSummaryTable";
import { ScoringForm } from "./ScoringForm";
import { CompositeResults } from "./CompositeResults";

export function EvaluationDashboard() {
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [scores, setScores] = useState<EvaluationScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"usage" | "scoring" | "results">(
    "usage",
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const [u, s] = await Promise.all([
      fetchUsageSummary(),
      fetchEvaluationScores(),
    ]);
    setUsage(u);
    setScores(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScoreSave = useCallback(
    async (
      score: Omit<EvaluationScore, "id" | "created_at" | "updated_at">,
    ) => {
      const result = await upsertEvaluationScore(score);
      if (result) {
        setScores((prev) => {
          const idx = prev.findIndex(
            (s) => s.test_run_id === result.test_run_id,
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = result;
            return next;
          }
          return [result, ...prev];
        });
        return true;
      }
      return false;
    },
    [],
  );

  const handleScoreDelete = useCallback(async (testRunId: string) => {
    const ok = await deleteEvaluationScore(testRunId);
    if (ok) {
      setScores((prev) => prev.filter((s) => s.test_run_id !== testRunId));
    }
    return ok;
  }, []);

  const tabs = [
    { id: "usage" as const, label: "Usage Log" },
    { id: "scoring" as const, label: "Score Reports" },
    { id: "results" as const, label: "Results" },
  ];

  return (
    <section className="mt-10 border-t border-outline-variant pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">
            Model Evaluation Dashboard
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Track usage costs, score report quality, and compare models.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (
                !confirm(
                  "Clear ALL usage logs and evaluation scores? This cannot be undone.",
                )
              )
                return;
              await clearAllTestData();
              setUsage([]);
              setScores([]);
            }}
            className="px-4 py-2 text-sm font-medium rounded-full bg-error-container text-on-error-container hover:bg-error-container/80 transition-colors duration-200"
          >
            Clear All Data
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-surface-container rounded-full p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && usage.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant text-sm">
          Loading evaluation data...
        </div>
      ) : (
        <>
          {activeTab === "usage" && <UsageSummaryTable data={usage} />}
          {activeTab === "scoring" && (
            <ScoringForm
              usage={usage}
              scores={scores}
              onSave={handleScoreSave}
              onDelete={handleScoreDelete}
            />
          )}
          {activeTab === "results" && (
            <CompositeResults usage={usage} scores={scores} />
          )}
        </>
      )}
    </section>
  );
}
