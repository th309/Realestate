/**
 * ConversionTab
 *
 * Conversion funnel, paywall effectiveness, feature-conversion correlation and
 * revenue.
 *
 * Layout:
 * 1. FullFunnel (full-width)
 * 2. Grid: FeatureCorrelationChart (left) + PaywallEffectiveness (right)
 * 3. Revenue (full-width)
 *
 * The tier-migration panel was removed rather than left rendering an empty
 * state. Tier-to-tier movement was derived from an `upgrade_complete` event
 * that has never been emitted, and there is no tier-change audit table to
 * derive it from — `user_profiles` holds only the current tier. The backend
 * returns `tierMigration: []` permanently and by design, so an empty panel
 * would have implied the data was merely missing rather than unobtainable.
 * The tier information the page CAN support is the current paid-tier
 * breakdown, which RevenueMetrics renders.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchConversionAnalytics } from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { EmptyState, SkeletonLoader } from "../shared";
import { FullFunnel } from "./FullFunnel";
import { FeatureCorrelationChart } from "./FeatureCorrelationChart";
import { PaywallEffectiveness } from "./PaywallEffectiveness";
import { RevenueMetrics } from "./RevenueMetrics";

interface ConversionTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

function PanelCard({
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

export function ConversionTab({ days, filters }: ConversionTabProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics", "conversion", days, filters],
    queryFn: () => fetchConversionAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="table" count={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load conversion data"
        description={
          error instanceof Error
            ? error.message
            : `Failed to fetch conversion analytics for the last ${days} days.`
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Full Funnel */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-on-surface">
          Conversion Funnel
        </h2>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
          <FullFunnel steps={data.fullFunnel} />
        </div>
      </div>

      {/* Row 2: Feature Correlation + Paywall Effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard title="Feature Usage vs Conversion">
          <FeatureCorrelationChart data={data.featureCorrelation} />
        </PanelCard>
        <PanelCard title="Paywall Effectiveness">
          <PaywallEffectiveness data={data.paywallEffectiveness} />
        </PanelCard>
      </div>

      {/* Row 3: Revenue */}
      <PanelCard title="Revenue">
        <RevenueMetrics
          mrr={data.revenueMetrics.mrr}
          arpu={data.revenueMetrics.arpu}
          tierDistribution={data.revenueMetrics.tierDistribution}
        />
      </PanelCard>
    </div>
  );
}
