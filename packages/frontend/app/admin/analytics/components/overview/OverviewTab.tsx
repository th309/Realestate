"use client";

/**
 * OverviewTab — Top-level data fetcher for the analytics overview.
 * Fetches all overview data once and distributes to sub-components as props.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchOverviewAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type { AnalyticsFilters } from "@/lib/data/fetchers/admin-analytics.types";
import { KpiCardRow } from "./KpiCardRow";
import { QuickFunnel } from "./QuickFunnel";
import { DauChart } from "./DauChart";
import { TopPagesTable } from "./TopPagesTable";
import { SkeletonLoader } from "../shared/SkeletonLoader";
import { EmptyState } from "../shared/EmptyState";

interface OverviewTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
}

export function OverviewTab({
  days,
  filters,
  compare,
  onDrillDown,
}: OverviewTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "overview", days, filters],
    queryFn: () => fetchOverviewAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <SkeletonLoader variant="card" count={6} />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="No data available"
        description="Analytics data will appear once events are collected."
      />
    );
  }

  return (
    <div className="space-y-6">
      <KpiCardRow
        kpis={data.kpis}
        sparklines={data.sparklines}
        compare={compare}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickFunnel steps={data.quickFunnel} />
        <DauChart data={data.activeUsersChart} annotations={data.annotations} />
      </div>
      <TopPagesTable
        pages={data.topPages}
        onRowClick={(page) => onDrillDown("page", page.pagePath)}
      />
    </div>
  );
}
