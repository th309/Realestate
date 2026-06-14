"use client";

import { useMemo, useState } from "react";
import type { TimeRange } from "../hooks/useTimeRange";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface PageViewEntry {
  timestamp: string;
  page_path: string;
  view_count: number;
  unique_visitors: number;
  bounce_rate: number;
}

interface AggregatedPage {
  pagePath: string;
  views: number;
  uniqueVisitors: number;
  bounceRate: number;
}

type SortField = "views" | "uniqueVisitors" | "bounceRate";

function aggregateByPage(entries: PageViewEntry[]): AggregatedPage[] {
  const map = new Map<string, { views: number; visitors: number; bounceSum: number; count: number }>();
  for (const e of entries) {
    const prev = map.get(e.page_path) ?? { views: 0, visitors: 0, bounceSum: 0, count: 0 };
    prev.views += e.view_count;
    prev.visitors += e.unique_visitors;
    prev.bounceSum += e.bounce_rate;
    prev.count += 1;
    map.set(e.page_path, prev);
  }
  return Array.from(map.entries()).map(([path, s]) => ({
    pagePath: path,
    views: s.views,
    uniqueVisitors: s.visitors,
    bounceRate: s.count > 0 ? Math.round(s.bounceSum / s.count) : 0,
  }));
}

export function FeatureUsagePanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<PageViewEntry[]>(
    "page-views",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const [sortField, setSortField] = useState<SortField>("views");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const agg = aggregateByPage(data ?? []);
    return agg.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortAsc ? diff : -diff;
    });
  }, [data, sortField, sortAsc]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-on-surface-variant">No data recorded yet</p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Page Usage ({rows.length} pages)
      </h3>
      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">
                Page
              </th>
              <th
                className="text-right px-3 py-2 text-on-surface-variant font-medium cursor-pointer select-none"
                onClick={() => handleSort("views")}
              >
                Views{sortIndicator("views")}
              </th>
              <th
                className="text-right px-3 py-2 text-on-surface-variant font-medium cursor-pointer select-none"
                onClick={() => handleSort("uniqueVisitors")}
              >
                Unique{sortIndicator("uniqueVisitors")}
              </th>
              <th
                className="text-right px-3 py-2 text-on-surface-variant font-medium cursor-pointer select-none"
                onClick={() => handleSort("bounceRate")}
              >
                Bounce %{sortIndicator("bounceRate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pagePath} className="border-t border-outline-variant">
                <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]">
                  {r.pagePath}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.views.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.uniqueVisitors.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.bounceRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
