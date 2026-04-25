"use client";

import { useEffect, useState } from "react";
import {
  resolveRanking,
  type ResolveRankingArgs,
  type ResolveRankingResponse,
} from "../lib/content-pipeline-api";

interface Props {
  args: ResolveRankingArgs;
  onBack: () => void;
  onSubmit: (resolved: ResolveRankingResponse) => void;
}

export function RankingPreviewStep({ args, onBack, onSubmit }: Props) {
  const [data, setData] = useState<ResolveRankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

   
  useEffect(() => {
    setError(null);
    setData(null);
    resolveRanking(args)
      .then(setData)
      .catch((e) => setError(String(e)));
    // JSON.stringify(args) is intentional — args is a plain object that changes by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(args)]);

  if (error) {
    return (
      <div className="rounded-lg bg-error-container p-4 text-on-error-container">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-on-surface-variant p-8">Resolving…</div>;
  }

  if (data.insufficient_data) {
    return (
      <div className="space-y-6 p-8">
        <h2 className="text-2xl font-semibold">
          Not enough data for a ranking
        </h2>
        <p className="text-on-surface-variant">
          Only {data.eligible_count} {data.geo_level}
          {data.eligible_count === 1 ? "" : "s"} in {data.scope.label} have
          current {data.metric.label} values. Minimum required: 5.
        </p>
        <p className="text-on-surface-variant">
          Try a broader scope or a different metric.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 border border-outline"
        >
          ← Back
        </button>
      </div>
    );
  }

  const directionLabel = data.direction === "top" ? "Top" : "Bottom";
  const levelLabel =
    data.geo_level === "zip"
      ? "ZIP Codes"
      : data.geo_level.charAt(0).toUpperCase() + data.geo_level.slice(1) + "s";

  return (
    <div className="space-y-6 p-8">
      <h2 className="text-2xl font-semibold">
        {directionLabel} {data.rankings.length} {levelLabel} in{" "}
        {data.scope.label} by {data.metric.label}
      </h2>
      <p className="text-sm text-on-surface-variant">As of {data.as_of}</p>

      <ol className="space-y-2">
        {data.rankings.map((m) => (
          <li
            key={m.region_id}
            className="flex justify-between rounded-lg bg-surface-container px-4 py-3"
          >
            <span>
              <span className="font-mono mr-3">#{m.rank}</span>
              {m.region_name}, {m.state}
            </span>
            <span className="font-mono">{m.value_formatted}</span>
          </li>
        ))}
      </ol>

      {data.excluded_count > 0 && (
        <p className="text-sm text-on-surface-variant">
          {data.excluded_count} {levelLabel.toLowerCase()} in {data.scope.label}{" "}
          had insufficient data and were excluded. Final ranking shows{" "}
          {directionLabel.toLowerCase()} {data.rankings.length} of{" "}
          {data.eligible_count} eligible.
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 border border-outline"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onSubmit(data)}
          className="rounded-full px-4 py-2 bg-primary text-on-primary"
        >
          Submit Run →
        </button>
      </div>
    </div>
  );
}
