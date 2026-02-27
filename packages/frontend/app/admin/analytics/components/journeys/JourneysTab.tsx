/**
 * JourneysTab
 *
 * User journey analytics: landing pages, exit pages, navigation flows,
 * common paths, and session duration distribution.
 *
 * Layout:
 * 1. Grid: LandingPagesTable (left) + ExitPagesTable (right)
 * 2. ProgressiveFlow (navigation flows)
 * 3. Grid: CommonPathsTable (left) + SessionDurationDist (right)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJourneyAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState } from "../shared/EmptyState";
import { SkeletonLoader } from "../shared/SkeletonLoader";
import { LandingPagesTable } from "./LandingPagesTable";
import { ExitPagesTable } from "./ExitPagesTable";
import { ProgressiveFlow } from "./ProgressiveFlow";
import { CommonPathsTable } from "./CommonPathsTable";
import { SessionDurationDist } from "./SessionDurationDist";

function mergeAnnotations(
  fromResponse: Annotation[],
  fromPage: Annotation[],
): Annotation[] {
  const seen = new Set(fromResponse.map((a) => a.id));
  return [...fromResponse, ...fromPage.filter((a) => !seen.has(a.id))];
}

interface JourneysTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

export function JourneysTab({
  days,
  filters,
  onDrillDown,
  annotations: pageAnnotations = [],
}: JourneysTabProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics", "journeys", days, filters],
    queryFn: () => fetchJourneyAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="table" />
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load journey data"
        description={
          error instanceof Error
            ? error.message
            : `Failed to fetch journey analytics for the last ${days} days.`
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Landing Pages + Exit Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LandingPagesTable
          pages={data.landingPages}
          onDrillDown={onDrillDown}
        />
        <ExitPagesTable pages={data.exitPages} onDrillDown={onDrillDown} />
      </div>

      {/* Row 2: Navigation Flows */}
      <ProgressiveFlow flows={data.navigationFlows} onDrillDown={onDrillDown} />

      {/* Row 3: Common Paths + Session Duration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommonPathsTable paths={data.commonPaths} onDrillDown={onDrillDown} />
        <SessionDurationDist buckets={data.sessionDurationDistribution} />
      </div>
    </div>
  );
}
