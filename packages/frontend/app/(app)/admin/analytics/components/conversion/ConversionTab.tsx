/**
 * ConversionTab
 *
 * Full conversion funnel, custom funnels, paywall effectiveness,
 * feature-conversion correlation, revenue metrics, and tier migration.
 *
 * Layout:
 * 1. FullFunnel (full-width)
 * 2. Grid: FeatureCorrelationChart (left) + PaywallEffectiveness (right)
 * 3. Grid: TierMigrationFlow (left) + RevenueMetrics (right)
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
import { TierMigrationFlow } from "./TierMigrationFlow";
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

export function ConversionTab({
  days,
  filters,
  onDrillDown,
}: ConversionTabProps) {
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

  const handleFunnelDrillDown = (stepName: string) => {
    onDrillDown("funnelStep", stepName);
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Full Funnel */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-on-surface">
          Conversion Funnel
        </h2>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
          <FullFunnel
            steps={data.fullFunnel}
            onStepClick={handleFunnelDrillDown}
          />
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

      {/* Row 3: Tier Migration + Revenue Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard title="Tier Migration Flow">
          <TierMigrationFlow tierMigration={data.tierMigration} />
        </PanelCard>
        <PanelCard title="Revenue Metrics">
          <RevenueMetrics
            mrr={data.revenueMetrics.mrr}
            arpu={data.revenueMetrics.arpu}
            tierDistribution={data.revenueMetrics.tierDistribution}
          />
        </PanelCard>
      </div>
    </div>
  );
}
