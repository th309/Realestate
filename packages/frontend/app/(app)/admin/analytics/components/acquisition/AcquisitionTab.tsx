/**
 * AcquisitionTab
 *
 * Traffic source breakdown, landing page performance,
 * source-to-conversion attribution, and channel trend lines.
 *
 * Layout:
 * 1. Grid: TrafficSourcesChart (left) + ChannelTrendChart (right)
 * 2. AttributionTable
 * 3. LandingPerfTable
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAcquisitionAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState, SkeletonLoader } from "../shared";
import { TrafficSourcesChart } from "./TrafficSourcesChart";
import { ChannelTrendChart } from "./ChannelTrendChart";
import { AttributionTable } from "./AttributionTable";
import { LandingPerfTable } from "./LandingPerfTable";

/** Merge annotations from the tab's API response with page-level annotations, deduping by id. */
function mergeAnnotations(
  fromResponse: Annotation[],
  fromPage: Annotation[],
): Annotation[] {
  const seen = new Set(fromResponse.map((a) => a.id));
  return [...fromResponse, ...fromPage.filter((a) => !seen.has(a.id))];
}

interface AcquisitionTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-on-surface">{title}</p>
      {children}
    </div>
  );
}

export function AcquisitionTab({
  days,
  filters,
  annotations: pageAnnotations = [],
}: AcquisitionTabProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics", "acquisition", days, filters],
    queryFn: () => fetchAcquisitionAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="table" count={5} />
        <SkeletonLoader variant="table" count={5} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load acquisition data"
        description={
          error instanceof Error
            ? error.message
            : `Failed to fetch acquisition analytics for the last ${days} days.`
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Traffic Sources + Channel Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel title="Traffic Sources">
          <TrafficSourcesChart data={data.trafficSources} />
        </ChartPanel>
        <ChartPanel title="Channel Trend">
          <ChannelTrendChart
            channelTrend={data.channelTrend}
            annotations={mergeAnnotations(data.annotations, pageAnnotations)}
          />
        </ChartPanel>
      </div>

      {/* Row 2: Source Attribution */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-on-surface">
          Source Attribution
        </h2>
        <AttributionTable data={data.sourceToConversion} />
      </div>

      {/* Row 3: Landing Page Performance */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-on-surface">
          Landing Page Performance
        </h2>
        <LandingPerfTable data={data.landingPagePerformance} />
      </div>
    </div>
  );
}
