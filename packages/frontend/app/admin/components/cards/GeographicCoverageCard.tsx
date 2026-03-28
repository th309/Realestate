"use client";

import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { DashboardCard } from "../shared/DashboardCard";

interface CoverageData {
  [geoLevel: string]: { [table: string]: number };
}

interface GeographicCoverageCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const GEO_LABELS: Record<string, string> = {
  metro: "Metro",
  county: "County",
  zip: "ZIP",
  state: "State",
};

const GEO_EXPECTED: Record<string, number> = {
  metro: 400,
  county: 3200,
  zip: 33000,
  state: 51,
};

export function GeographicCoverageCard({
  refreshTrigger,
  onClick,
}: GeographicCoverageCardProps) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw("/api/admin/metrics/coverage");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.data ?? json);
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

  return (
    <DashboardCard
      title="Geographic Coverage"
      icon={MapPin}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {data ? (
        <div className="space-y-2">
          {Object.entries(GEO_LABELS).map(([level, label]) => {
            const levelData = data[level];
            if (!levelData) return null;
            const maxCount = Math.max(...Object.values(levelData));
            const expected = GEO_EXPECTED[level] || maxCount;
            const fillPct = Math.min((maxCount / expected) * 100, 100);
            return (
              <div key={level} className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant w-14 shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-on-surface w-14 text-right">
                  {maxCount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No coverage data available
        </p>
      )}
    </DashboardCard>
  );
}
