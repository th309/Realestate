/**
 * Composite Results
 *
 * Combines usage data (cost, speed) with manual quality scores
 * to calculate weighted composite scores and rank models.
 */

"use client";

import type {
  UsageSummary,
  EvaluationScore,
} from "@/lib/data/fetchers/ai-models";

// Weights from design doc
const WEIGHTS = {
  depth: 0.3,
  accuracy: 0.25,
  writing: 0.2,
  cost: 0.1,
  actionability: 0.1,
  speed: 0.05,
};

/** Map cost in USD to a 1-5 score. */
function costToScore(costUsd: number): number {
  if (costUsd < 0.1) return 5;
  if (costUsd < 0.25) return 4;
  if (costUsd < 0.5) return 3;
  if (costUsd < 1.0) return 2;
  return 1;
}

/** Map total duration in ms to a 1-5 score. */
function speedToScore(avgDurationMs: number): number {
  if (avgDurationMs < 15000) return 5;
  if (avgDurationMs < 30000) return 4;
  if (avgDurationMs < 45000) return 3;
  if (avgDurationMs < 60000) return 2;
  return 1;
}

interface CompositeRow {
  testRunId: string;
  model: string;
  provider: string;
  reportType: string;
  geography: string;
  depth: number;
  accuracy: number;
  writing: number;
  actionability: number;
  cost: number;
  speed: number;
  composite: number;
  costUsd: number;
  avgDurationMs: number;
  notes: string;
}

function computeComposite(row: Omit<CompositeRow, "composite">): number {
  return (
    row.depth * WEIGHTS.depth +
    row.accuracy * WEIGHTS.accuracy +
    row.writing * WEIGHTS.writing +
    row.cost * WEIGHTS.cost +
    row.actionability * WEIGHTS.actionability +
    row.speed * WEIGHTS.speed
  );
}

function compositeColor(score: number): string {
  if (score >= 4.0) return "text-green-600";
  if (score >= 3.0) return "text-amber-600";
  if (score >= 2.0) return "text-orange-600";
  return "text-red-600";
}

function ScorePill({ value }: { value: number }) {
  const color =
    value >= 4
      ? "bg-green-100 text-green-800"
      : value >= 3
        ? "bg-amber-100 text-amber-800"
        : value >= 2
          ? "bg-orange-100 text-orange-800"
          : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {value}
    </span>
  );
}

export function CompositeResults({
  usage,
  scores,
}: {
  usage: UsageSummary[];
  scores: EvaluationScore[];
}) {
  // Only show scored test runs
  const rows: CompositeRow[] = scores
    .filter(
      (s) =>
        s.depth_score != null &&
        s.accuracy_score != null &&
        s.writing_score != null &&
        s.actionability_score != null,
    )
    .map((s) => {
      const u = usage.find((u) => u.test_run_id === s.test_run_id);
      const costUsd = u?.total_cost_usd ?? 0;
      const avgDurationMs = u?.avg_duration_ms ?? 0;
      const costScore = costToScore(costUsd);
      const speedScore = speedToScore(avgDurationMs);

      const partial = {
        testRunId: s.test_run_id,
        model: s.model,
        provider: s.provider,
        reportType: s.report_type || "-",
        geography: s.geography || "-",
        depth: s.depth_score!,
        accuracy: s.accuracy_score!,
        writing: s.writing_score!,
        actionability: s.actionability_score!,
        cost: costScore,
        speed: speedScore,
        costUsd,
        avgDurationMs,
        notes: s.notes || "",
      };

      return { ...partial, composite: computeComposite(partial) };
    })
    .sort((a, b) => b.composite - a.composite);

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-on-surface-variant text-sm">
        No scored test runs yet. Score some reports in the &quot;Score
        Reports&quot; tab first.
      </div>
    );
  }

  // Aggregate by model for the summary
  const modelAverages = new Map<
    string,
    { model: string; provider: string; scores: CompositeRow[] }
  >();
  for (const row of rows) {
    if (!modelAverages.has(row.model)) {
      modelAverages.set(row.model, {
        model: row.model,
        provider: row.provider,
        scores: [],
      });
    }
    modelAverages.get(row.model)!.scores.push(row);
  }

  const modelSummary = Array.from(modelAverages.values())
    .map((g) => {
      const avg = (fn: (r: CompositeRow) => number) =>
        g.scores.reduce((sum, r) => sum + fn(r), 0) / g.scores.length;
      return {
        model: g.model,
        provider: g.provider,
        count: g.scores.length,
        depth: Math.round(avg((r) => r.depth) * 10) / 10,
        accuracy: Math.round(avg((r) => r.accuracy) * 10) / 10,
        writing: Math.round(avg((r) => r.writing) * 10) / 10,
        actionability: Math.round(avg((r) => r.actionability) * 10) / 10,
        cost: Math.round(avg((r) => r.cost) * 10) / 10,
        speed: Math.round(avg((r) => r.speed) * 10) / 10,
        composite: Math.round(avg((r) => r.composite) * 100) / 100,
        avgCost: Math.round(avg((r) => r.costUsd) * 10000) / 10000,
      };
    })
    .sort((a, b) => b.composite - a.composite);

  return (
    <div className="space-y-8">
      {/* Model Ranking Summary */}
      <div>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Model Rankings (averaged across all scored reports)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant text-left">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-center">Reports</th>
                <th className="px-4 py-3 font-medium text-center">Depth</th>
                <th className="px-4 py-3 font-medium text-center">Accuracy</th>
                <th className="px-4 py-3 font-medium text-center">Writing</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
                <th className="px-4 py-3 font-medium text-center">Cost</th>
                <th className="px-4 py-3 font-medium text-center">Speed</th>
                <th className="px-4 py-3 font-medium text-center">Avg $/rpt</th>
                <th className="px-4 py-3 font-medium text-right">Composite</th>
              </tr>
            </thead>
            <tbody>
              {modelSummary.map((m, i) => (
                <tr
                  key={m.model}
                  className={`border-t border-outline-variant ${i === 0 ? "bg-green-50/50" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-on-surface-variant">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-on-surface">
                      {m.model}
                    </span>
                    <span className="text-on-surface-variant text-xs ml-1">
                      ({m.provider})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-on-surface-variant">
                    {m.count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.depth} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.accuracy} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.writing} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.actionability} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.cost} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScorePill value={m.speed} />
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-on-surface-variant">
                    ${m.avgCost.toFixed(4)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold text-lg ${compositeColor(m.composite)}`}
                  >
                    {m.composite.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Scores Detail */}
      <div>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          All Scored Reports
        </h3>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant text-left">
                <th className="px-3 py-2 font-medium">Test Run</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Geo</th>
                <th className="px-3 py-2 font-medium text-center">D</th>
                <th className="px-3 py-2 font-medium text-center">A</th>
                <th className="px-3 py-2 font-medium text-center">W</th>
                <th className="px-3 py-2 font-medium text-center">Act</th>
                <th className="px-3 py-2 font-medium text-center">$</th>
                <th className="px-3 py-2 font-medium text-center">Spd</th>
                <th className="px-3 py-2 font-medium text-right">Score</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.testRunId}
                  className="border-t border-outline-variant hover:bg-surface-container-low"
                >
                  <td className="px-3 py-2 font-mono text-primary">
                    {r.testRunId}
                  </td>
                  <td className="px-3 py-2 text-on-surface">{r.model}</td>
                  <td className="px-3 py-2 text-on-surface-variant">
                    {r.reportType}
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant">
                    {r.geography}
                  </td>
                  <td className="px-3 py-2 text-center">{r.depth}</td>
                  <td className="px-3 py-2 text-center">{r.accuracy}</td>
                  <td className="px-3 py-2 text-center">{r.writing}</td>
                  <td className="px-3 py-2 text-center">{r.actionability}</td>
                  <td className="px-3 py-2 text-center">{r.cost}</td>
                  <td className="px-3 py-2 text-center">{r.speed}</td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${compositeColor(r.composite)}`}
                  >
                    {r.composite.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant max-w-[200px] truncate">
                    {r.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
