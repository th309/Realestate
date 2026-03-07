/**
 * Scoring Form
 *
 * Score test runs on 4 manual quality dimensions (1-5).
 * Shows each test run from the usage log with score inputs.
 * Saves/updates scores to ai_model_evaluation_scores table.
 */

"use client";

import { useState } from "react";
import type {
  UsageSummary,
  EvaluationScore,
} from "@/lib/data/fetchers/ai-models";

interface ScoringFormProps {
  usage: UsageSummary[];
  scores: EvaluationScore[];
  onSave: (
    score: Omit<EvaluationScore, "id" | "created_at" | "updated_at">,
  ) => Promise<boolean>;
  onDelete: (testRunId: string) => Promise<boolean>;
}

const DIMENSIONS = [
  { key: "depth_score" as const, label: "Depth", weight: "30%" },
  { key: "accuracy_score" as const, label: "Accuracy", weight: "25%" },
  { key: "writing_score" as const, label: "Writing", weight: "20%" },
  { key: "actionability_score" as const, label: "Action", weight: "10%" },
] as const;

function ScoreButton({
  value,
  selected,
  onClick,
}: {
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ${
        selected
          ? "bg-primary text-on-primary"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      {value}
    </button>
  );
}

function ScoreRow({
  run,
  existingScore,
  onSave,
  onDelete,
}: {
  run: UsageSummary;
  existingScore: EvaluationScore | undefined;
  onSave: ScoringFormProps["onSave"];
  onDelete: ScoringFormProps["onDelete"];
}) {
  const [depth, setDepth] = useState(existingScore?.depth_score ?? 0);
  const [accuracy, setAccuracy] = useState(existingScore?.accuracy_score ?? 0);
  const [writing, setWriting] = useState(existingScore?.writing_score ?? 0);
  const [actionability, setActionability] = useState(
    existingScore?.actionability_score ?? 0,
  );
  const [reportType, setReportType] = useState(
    existingScore?.report_type ?? "",
  );
  const [geography, setGeography] = useState(existingScore?.geography ?? "");
  const [notes, setNotes] = useState(existingScore?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allScored =
    depth > 0 && accuracy > 0 && writing > 0 && actionability > 0;

  const handleSave = async () => {
    if (!allScored) return;
    setSaving(true);
    const ok = await onSave({
      test_run_id: run.test_run_id,
      model: run.model,
      provider: run.provider,
      report_type: reportType || null,
      geography: geography || null,
      depth_score: depth,
      accuracy_score: accuracy,
      writing_score: writing,
      actionability_score: actionability,
      notes: notes || null,
      report_id: null,
    });
    setToast(ok ? "Saved" : "Failed");
    setTimeout(() => setToast(null), 2000);
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(run.test_run_id);
    setDepth(0);
    setAccuracy(0);
    setWriting(0);
    setActionability(0);
    setNotes("");
    setSaving(false);
  };

  const setters = {
    depth_score: setDepth,
    accuracy_score: setAccuracy,
    writing_score: setWriting,
    actionability_score: setActionability,
  };
  const values = {
    depth_score: depth,
    accuracy_score: accuracy,
    writing_score: writing,
    actionability_score: actionability,
  };

  return (
    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-mono text-xs text-primary font-medium">
            {run.test_run_id}
          </span>
          <span className="ml-2 text-sm text-on-surface">{run.model}</span>
          <span className="ml-1 text-xs text-on-surface-variant">
            ({run.provider})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {toast && (
            <span className="text-xs text-green-600 font-medium">{toast}</span>
          )}
          {existingScore && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1 text-xs rounded-full bg-error-container text-on-error-container hover:bg-error-container/80 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Context fields */}
      <div className="flex gap-3 mb-3">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="px-2 py-1 text-xs rounded-lg bg-surface border border-outline-variant text-on-surface"
        >
          <option value="">Report Type...</option>
          <option value="homeready">HomeReady</option>
          <option value="investoredge">InvestorEdge</option>
          <option value="comparison">Comparison</option>
          <option value="custom">Custom</option>
        </select>
        <select
          value={geography}
          onChange={(e) => setGeography(e.target.value)}
          className="px-2 py-1 text-xs rounded-lg bg-surface border border-outline-variant text-on-surface"
        >
          <option value="">Geography...</option>
          <option value="tampa">Tampa, FL</option>
          <option value="columbus">Columbus, OH</option>
          <option value="conway-zip">Conway, AR (ZIP)</option>
        </select>
      </div>

      {/* Score buttons */}
      <div className="grid grid-cols-4 gap-4 mb-3">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key}>
            <div className="text-xs text-on-surface-variant mb-1">
              {dim.label}{" "}
              <span className="text-on-surface-variant/60">({dim.weight})</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <ScoreButton
                  key={v}
                  value={v}
                  selected={values[dim.key] === v}
                  onClick={() => setters[dim.key](v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Notes + save */}
      <div className="flex gap-3 items-end">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="flex-1 px-3 py-2 text-xs rounded-lg bg-surface border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50"
        />
        <button
          onClick={handleSave}
          disabled={!allScored || saving}
          className="px-4 py-2 text-xs font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 transition-colors duration-200"
        >
          {saving ? "Saving..." : existingScore ? "Update" : "Save Score"}
        </button>
      </div>
    </div>
  );
}

export function ScoringForm({
  usage,
  scores,
  onSave,
  onDelete,
}: ScoringFormProps) {
  if (usage.length === 0) {
    return (
      <div className="py-12 text-center text-on-surface-variant text-sm">
        No test runs to score yet. Generate reports with a Test Run ID set.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usage.map((run) => (
        <ScoreRow
          key={run.test_run_id}
          run={run}
          existingScore={scores.find((s) => s.test_run_id === run.test_run_id)}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
