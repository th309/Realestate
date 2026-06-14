/**
 * RetentionTab
 *
 * Cohort retention matrix, DAU/WAU/MAU stickiness,
 * retention curves by tier, churn signals, and engagement trend.
 *
 * Layout:
 * 1. EngagementHealth (DAU/WAU/MAU/Stickiness cards)
 * 2. CohortMatrix (weekly cohort retention heat map)
 * 3. Grid: RetentionByCurve (left) + ChurnRiskTable (right)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRetentionAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState } from "../shared/EmptyState";
import { SkeletonLoader } from "../shared/SkeletonLoader";
import { EngagementHealth } from "./EngagementHealth";
import { CohortMatrix } from "./CohortMatrix";
import { RetentionByCurve } from "./RetentionByCurve";
import { ChurnRiskTable } from "./ChurnRiskTable";

interface RetentionTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

export function RetentionTab({
  days,
  filters,
  onDrillDown,
}: RetentionTabProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics", "retention", days, filters],
    queryFn: () => fetchRetentionAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="card" count={4} />
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load retention data"
        description={
          error instanceof Error
            ? error.message
            : `Failed to fetch retention analytics for the last ${days} days.`
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: DAU / WAU / MAU / Stickiness */}
      <EngagementHealth
        dau={data.dauWauMau.dau}
        wau={data.dauWauMau.wau}
        mau={data.dauWauMau.mau}
        stickiness={data.dauWauMau.stickiness}
      />

      {/* Row 2: Cohort Retention Matrix */}
      <CohortMatrix
        matrix={data.cohortMatrix}
        onCellClick={(cohort, week) =>
          onDrillDown("cohort", `${cohort}:wk${week}`)
        }
      />

      {/* Row 3: Retention Curves + Churn Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RetentionByCurve retentionCurves={data.retentionCurves} />
        <ChurnRiskTable users={data.churnSignals} />
      </div>
    </div>
  );
}
