"use client";

import { BarChart3 } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PageViewRow {
  timestamp: string;
  page_path: string;
  view_count: number;
  unique_visitors: number;
  bounce_rate: number;
}

interface FeatureUsageCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function FeatureUsageCard({
  refreshTrigger,
  onClick,
}: FeatureUsageCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<PageViewRow[]>(
    "page-views",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Aggregate by page_path
  const pageMap = new Map<string, { views: number; visitors: number }>();
  for (const row of rows) {
    const existing = pageMap.get(row.page_path) || {
      views: 0,
      visitors: 0,
    };
    existing.views += row.view_count;
    existing.visitors += row.unique_visitors;
    pageMap.set(row.page_path, existing);
  }

  const topPages = Array.from(pageMap.entries())
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 5);
  const maxViews = topPages.length > 0 ? topPages[0][1].views : 1;

  return (
    <DashboardCard
      title="Feature Usage"
      icon={BarChart3}
      badge={
        rows.length > 0
          ? {
              text: `${pageMap.size} pages`,
              color: "bg-blue-500/10 text-blue-700",
            }
          : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {topPages.length > 0 ? (
        <div className="space-y-2">
          {topPages.map(([path, stats]) => (
            <div key={path} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface truncate max-w-[180px]">
                  {path}
                </span>
                <span className="text-on-surface-variant font-mono">
                  {stats.views.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full"
                  style={{ width: `${(stats.views / maxViews) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No page view data available
        </p>
      )}
    </DashboardCard>
  );
}
