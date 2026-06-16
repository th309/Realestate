/**
 * AI Model Evaluation Lab
 *
 * Batch-runs reports across models, logs usage/cost, and lets admins score
 * and rank model quality. Split out from the model-config page so each route
 * has one responsibility.
 */

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { setTestRunId as setTestRunIdApi } from "@/lib/data/fetchers/ai-models";
import { TestRunner } from "./components/TestRunner";
import { EvaluationDashboard } from "./components/EvaluationDashboard";

export default function AiModelEvaluationPage() {
  const [testRunId, setTestRunId] = useState("");
  const [testRunSaving, setTestRunSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const dashboardRefreshRef = useRef<() => void>(null);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">
              AI Model Evaluation Lab
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Batch-run reports across models, then score and rank quality.
            </p>
          </div>
          <Link
            href="/admin/ai-models"
            className="px-4 py-2 text-sm font-medium rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors duration-200"
          >
            ← Model Config
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Test Run ID — lifted verbatim from the old config page (lines 129-164). */}
        <div className="mb-6 p-4 rounded-xl bg-surface-container-low border border-outline-variant flex items-center gap-4">
          <label
            htmlFor="test-run-id"
            className="text-sm font-medium text-on-surface whitespace-nowrap"
          >
            Test Run ID
          </label>
          <input
            id="test-run-id"
            type="text"
            value={testRunId}
            onChange={(e) => setTestRunId(e.target.value)}
            placeholder="e.g. p1-sonnet46-tampa (empty = no tagging)"
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={async () => {
              setTestRunSaving(true);
              const result = await setTestRunIdApi(testRunId || null);
              setTestRunId(result || "");
              setToast({
                message: testRunId
                  ? `Test run ID set: ${testRunId}`
                  : "Test run ID cleared.",
                type: "success",
              });
              setTimeout(() => setToast(null), 4000);
              setTestRunSaving(false);
            }}
            disabled={testRunSaving}
            className="px-4 py-2 text-sm font-medium rounded-full bg-tertiary text-on-tertiary hover:bg-tertiary/90 disabled:opacity-50 transition-colors duration-200"
          >
            {testRunSaving ? "Saving..." : testRunId ? "Set" : "Clear"}
          </button>
        </div>

        <TestRunner onBatchComplete={() => dashboardRefreshRef.current?.()} />
        <EvaluationDashboard onRefreshRef={dashboardRefreshRef} />
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
            toast.type === "success"
              ? "bg-green-700 text-white"
              : "bg-red-700 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
