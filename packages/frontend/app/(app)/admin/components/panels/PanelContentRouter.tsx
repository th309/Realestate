"use client";

import { lazy, Suspense } from "react";
import type { TimeRange } from "../hooks/useTimeRange";

// Lazy-load panel content to avoid loading all 15 panels upfront
const DataFeedsPanel = lazy(() =>
  import("./DataFeedsPanel").then((m) => ({ default: m.DataFeedsPanel })),
);
const PipelineRunsPanel = lazy(() =>
  import("./PipelineRunsPanel").then((m) => ({ default: m.PipelineRunsPanel })),
);
const ApiPerformancePanel = lazy(() =>
  import("./ApiPerformancePanel").then((m) => ({
    default: m.ApiPerformancePanel,
  })),
);
const CachePerformancePanel = lazy(() =>
  import("./CachePerformancePanel").then((m) => ({
    default: m.CachePerformancePanel,
  })),
);
const ActiveAlertsPanel = lazy(() =>
  import("./ActiveAlertsPanel").then((m) => ({ default: m.ActiveAlertsPanel })),
);
const ScoreHealthPanel = lazy(() =>
  import("./ScoreHealthPanel").then((m) => ({ default: m.ScoreHealthPanel })),
);
const MlOpsPanel = lazy(() =>
  import("./MlOpsPanel").then((m) => ({ default: m.MlOpsPanel })),
);
const GeographicCoveragePanel = lazy(() =>
  import("./GeographicCoveragePanel").then((m) => ({
    default: m.GeographicCoveragePanel,
  })),
);
const DataQualityPanel = lazy(() =>
  import("./DataQualityPanel").then((m) => ({ default: m.DataQualityPanel })),
);
const ScoreComputationPanel = lazy(() =>
  import("./ScoreComputationPanel").then((m) => ({
    default: m.ScoreComputationPanel,
  })),
);
const UsersGrowthPanel = lazy(() =>
  import("./UsersGrowthPanel").then((m) => ({ default: m.UsersGrowthPanel })),
);
const RevenueMrrPanel = lazy(() =>
  import("./RevenueMrrPanel").then((m) => ({ default: m.RevenueMrrPanel })),
);
const FeatureUsagePanel = lazy(() =>
  import("./FeatureUsagePanel").then((m) => ({ default: m.FeatureUsagePanel })),
);
const TierDistributionPanel = lazy(() =>
  import("./TierDistributionPanel").then((m) => ({
    default: m.TierDistributionPanel,
  })),
);
const FeedbackQueuePanel = lazy(() =>
  import("./FeedbackQueuePanel").then((m) => ({
    default: m.FeedbackQueuePanel,
  })),
);

interface PanelContentRouterProps {
  cardId: string | null;
  timeRange: TimeRange;
  refreshTrigger: number;
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-surface-container rounded-xl" />
      <div className="h-4 bg-surface-container rounded w-3/4" />
      <div className="h-4 bg-surface-container rounded w-1/2" />
    </div>
  );
}

const PANEL_MAP: Record<
  string,
  React.ComponentType<{ timeRange: TimeRange; refreshTrigger: number }>
> = {
  "data-feeds": DataFeedsPanel,
  "pipeline-runs": PipelineRunsPanel,
  "api-performance": ApiPerformancePanel,
  "cache-performance": CachePerformancePanel,
  "active-alerts": ActiveAlertsPanel,
  "score-health": ScoreHealthPanel,
  "ml-ops": MlOpsPanel,
  "geographic-coverage": GeographicCoveragePanel,
  "data-quality": DataQualityPanel,
  "score-computation": ScoreComputationPanel,
  "users-growth": UsersGrowthPanel,
  "revenue-mrr": RevenueMrrPanel,
  "feature-usage": FeatureUsagePanel,
  "tier-distribution": TierDistributionPanel,
  "feedback-queue": FeedbackQueuePanel,
};

export function PanelContentRouter({
  cardId,
  timeRange,
  refreshTrigger,
}: PanelContentRouterProps) {
  if (!cardId) return null;

  const PanelComponent = PANEL_MAP[cardId];
  if (!PanelComponent) {
    return (
      <div className="text-center py-12 text-on-surface-variant text-sm">
        Panel not implemented for &quot;{cardId}&quot;
      </div>
    );
  }

  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelComponent timeRange={timeRange} refreshTrigger={refreshTrigger} />
    </Suspense>
  );
}
