"use client";

import { useState, useEffect } from "react";
import { Database } from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";

interface SourceHealth {
  sourceName: string;
  displayName: string;
  available: boolean;
  fresh: boolean;
  daysSinceUpdate: number | null;
  expectedFreshnessDays: number;
}

interface DataSourcesResponse {
  status: "healthy" | "degraded" | "unhealthy";
  sources: SourceHealth[];
  summary: { total: number; available: number; fresh: number };
}

interface DataFeedsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function DataFeedsCard({ refreshTrigger, onClick }: DataFeedsCardProps) {
  const [data, setData] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw("/api/health/data-sources");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DataSourcesResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const badgeText = data
    ? `${data.summary.fresh}/${data.summary.total} Fresh`
    : undefined;
  const badgeColor =
    data && data.summary.fresh === data.summary.total
      ? "bg-green-500/10 text-green-700"
      : "bg-amber-500/10 text-amber-700";

  return (
    <DashboardCard
      title="Data Feeds"
      icon={Database}
      badge={data ? { text: badgeText!, color: badgeColor } : undefined}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {data && (
        <ul className="space-y-1.5">
          {data.sources.slice(0, 6).map((source) => (
            <li
              key={source.sourceName}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <StatusDot variant={source.available ? "success" : "error"} />
                <span className="text-on-surface truncate">
                  {source.displayName}
                </span>
              </div>
              <span
                className={`font-mono ${source.fresh ? "text-green-600" : "text-red-500"}`}
              >
                {source.daysSinceUpdate !== null
                  ? `${source.daysSinceUpdate}d`
                  : "\u2014"}
              </span>
            </li>
          ))}
          {data.sources.length > 6 && (
            <li className="text-xs text-on-surface-variant">
              +{data.sources.length - 6} more
            </li>
          )}
        </ul>
      )}
    </DashboardCard>
  );
}
