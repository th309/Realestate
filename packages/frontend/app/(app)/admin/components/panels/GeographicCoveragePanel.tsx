"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data";
import type { TimeRange } from "../hooks/useTimeRange";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

type CoverageData = Record<string, Record<string, number>>;

const GEO_LABELS: Record<string, string> = {
  state: "State",
  metro: "Metro",
  county: "County",
  zip: "ZIP",
};

function useCoverageData(refreshTrigger: number) {
  return useQuery<CoverageData>({
    queryKey: ["admin", "coverage", refreshTrigger],
    queryFn: async () => {
      const res = await fetchAPIRaw("/api/admin/metrics/coverage");
      if (!res.ok) throw new Error(`Coverage fetch failed: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function GeographicCoveragePanel({
  refreshTrigger,
}: PanelProps) {
  const { data, isLoading } = useCoverageData(refreshTrigger);

  const { geoLevels, tables } = useMemo(() => {
    if (!data) return { geoLevels: [], tables: [] };
    const levels = Object.keys(data).sort(
      (a, b) => (Object.keys(GEO_LABELS).indexOf(a) ?? 99) - (Object.keys(GEO_LABELS).indexOf(b) ?? 99),
    );
    const tableSet = new Set<string>();
    for (const geo of levels) {
      for (const t of Object.keys(data[geo])) tableSet.add(t);
    }
    return { geoLevels: levels, tables: Array.from(tableSet).sort() };
  }, [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  if (!data || !geoLevels.length) {
    return (
      <p className="text-sm text-on-surface-variant">No data recorded yet</p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Coverage Matrix
      </h3>
      <div className="border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">
                Geo Level
              </th>
              {tables.map((t) => (
                <th
                  key={t}
                  className="text-right px-3 py-2 text-on-surface-variant font-medium whitespace-nowrap"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {geoLevels.map((geo) => (
              <tr key={geo} className="border-t border-outline-variant">
                <td className="px-3 py-2 font-medium">
                  {GEO_LABELS[geo] ?? geo}
                </td>
                {tables.map((t) => {
                  const count = data[geo]?.[t] ?? 0;
                  return (
                    <td
                      key={t}
                      className={`px-3 py-2 text-right font-mono ${
                        count > 0
                          ? "bg-green-500/10 text-green-700"
                          : "text-on-surface-variant/50"
                      }`}
                    >
                      {count > 0 ? count.toLocaleString() : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
