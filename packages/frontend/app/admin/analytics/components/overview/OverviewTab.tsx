"use client";

/**
 * OverviewTab — Top-level data fetcher for the analytics overview.
 * Fetches all overview data once and distributes to sub-components as props.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchOverviewAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { KpiCardRow } from "./KpiCardRow";
import { QuickFunnel } from "./QuickFunnel";
import { DauChart } from "./DauChart";
import { TopPagesTable } from "./TopPagesTable";
import { SkeletonLoader } from "../shared/SkeletonLoader";
import { EmptyState } from "../shared/EmptyState";

/** Merge annotations from the tab's API response with page-level annotations, deduping by id. */
function mergeAnnotations(
  fromResponse: Annotation[],
  fromPage: Annotation[],
): Annotation[] {
  const seen = new Set(fromResponse.map((a) => a.id));
  return [...fromResponse, ...fromPage.filter((a) => !seen.has(a.id))];
}

interface OverviewTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

export function OverviewTab({
  days,
  filters,
  compare,
  onDrillDown,
  annotations: pageAnnotations = [],
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
        <DauChart
          data={data.activeUsersChart}
          annotations={mergeAnnotations(data.annotations, pageAnnotations)}
        />
      </div>
      <TopPagesTable
        pages={data.topPages}
        onRowClick={(page) => onDrillDown("page", page.pagePath)}
      />
    </div>
  );
}
