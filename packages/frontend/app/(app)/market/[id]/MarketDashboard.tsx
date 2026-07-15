"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  useMarketSnapshot,
  isMetricSupportedForGeo,
  incrementUsageStat,
  type GeoLevel,
} from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { useQueryClient } from "@tanstack/react-query";
import { MarketLimitUpgradePrompt } from "@/components/entitlements";
import {
  DashboardHeader,
  ViewToggle,
  MetricRail,
  MarketPrimaryChart,
  QuickActions,
  MobileViewToggle,
  DashboardLoadingSpinner,
  DashboardErrorState,
  DashboardGeoGateWall,
  PREMIUM_GEO_LEVELS,
  ShareMarketModal,
} from "./components";
import {
  RAIL_METRIC_IDS,
  pickDefaultRailMetric,
} from "./components/market-rail-metrics";
import { MarketHeadline } from "./MarketHeadline";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";
import { TourSpotlight } from "@/app/tour/components/TourSpotlight";

interface MarketDashboardProps {
  geographyId: string;
  geographyType: "metro" | "county" | "zip";
  userView: "investor" | "homebuyer";
  stateFilter?: string;
}

export function MarketDashboard({
  geographyId,
  geographyType,
  userView,
  stateFilter,
}: MarketDashboardProps) {
  const [activeView, setActiveView] = useState<"investor" | "homebuyer">(
    userView,
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Track market view for onboarding (once per geography)
  const trackedGeoRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackedGeoRef.current === geographyId) return;
    trackedGeoRef.current = geographyId;
    incrementUsageStat("markets_viewed").catch(console.error);
  }, [geographyId]);

  // Entitlements for geography level
  const { getAccess, canAccess } = useEntitlements();
  const geoAccess = getAccess("geo", geographyType);
  const hasGeoAccess =
    geoAccess.level === "full" ||
    geoAccess.level === "preview" ||
    !PREMIUM_GEO_LEVELS.includes(geographyType);
  const canExport = canAccess("feature", "export_csv");

  const handleDownloadMarket = useCallback(() => {
    if (!canExport) return;
    window.print();
  }, [canExport]);

  const effectiveStateFilter = useMemo(() => {
    if (geographyType === "metro") return undefined;
    if (stateFilter) return stateFilter;
    return undefined;
  }, [stateFilter, geographyType]);

  // Single hook: all metric cards + scores + trends in 2 calls
  const {
    cards,
    scores,
    geography,
    lastUpdated,
    dataUpdatedAt,
    isLoading,
    error,
  } = useMarketSnapshot(geographyType, geographyId, {
    state: effectiveStateFilter,
    trendMonths: 3,
  });

  // Apply home_value → listing_price fallback (matches prior behavior)
  const displayData = useMemo(() => {
    const result = { ...cards };
    if (!result["home_value"]?.value && result["listing_price"]?.value) {
      result["home_value"] = { ...result["listing_price"] };
    }
    return result;
  }, [cards]);

  // Rail metrics = configured set, filtered to supported + present for this geo
  const railMetricIds = useMemo(
    () =>
      RAIL_METRIC_IDS.filter(
        (id) =>
          isMetricSupportedForGeo(id, geographyType as GeoLevel) &&
          displayData[id] !== undefined,
      ),
    [geographyType, displayData],
  );

  // Keep the charted metric valid: default to home_value, reset if it drops out
  useEffect(() => {
    if (railMetricIds.length === 0) return;
    setSelectedMetricId((current) =>
      current && railMetricIds.includes(current)
        ? current
        : pickDefaultRailMetric(displayData, geographyType),
    );
  }, [railMetricIds, displayData, geographyType]);

  const updatedDateLabel = useMemo(() => {
    if (!lastUpdated) return "Unknown";
    const parsed = new Date(lastUpdated);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString();
  }, [lastUpdated]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["market-snapshot", geographyType, geographyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["market-snapshot-trends", geographyType, geographyId],
    });
  }, [queryClient, geographyType, geographyId]);

  if (isLoading) {
    return <DashboardLoadingSpinner />;
  }

  if (error || !geography) {
    return (
      <DashboardErrorState
        errorMessage={error?.message ?? "Unknown error"}
        onRetry={handleRefresh}
      />
    );
  }

  if (!hasGeoAccess) {
    return <DashboardGeoGateWall geographyType={geographyType} />;
  }

  const primaryScore = scores?.propertyiq;
  const chartMetricId =
    selectedMetricId ?? railMetricIds[0] ?? RAIL_METRIC_IDS[0];

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        geographyId={geographyId}
        geographyName={geography.name}
        geographyType={geographyType}
        updatedDateLabel={updatedDateLabel}
        dataUpdatedAt={dataUpdatedAt}
        canExport={canExport}
        onRefresh={handleRefresh}
        onShare={() => setShareModalOpen(true)}
        onDownload={handleDownloadMarket}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2">
        <SocialProofBadge
          geoLevel={geographyType}
          geoId={geographyId}
          variant="tracking"
        />
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <ViewToggle activeView={activeView} onViewChange={setActiveView} />

        {/* Hybrid: short AI framing sets context */}
        <div data-tour="ai-assessment">
          <MarketHeadline
            geoType={geographyType}
            geoId={geographyId}
            marketName={geography.name}
            view={activeView}
            cards={displayData}
            score={primaryScore?.score ?? null}
            scoreGrade={(primaryScore as { grade?: string })?.grade ?? "—"}
          />
        </div>

        {/* Primary chart (spine) + metric rail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <MarketPrimaryChart
              geoType={geographyType as GeoLevel}
              geoId={geographyId}
              marketName={geography.name}
              metricId={chartMetricId}
            />
          </div>
          <div className="lg:col-span-4">
            <MetricRail
              geoType={geographyType}
              geoId={geographyId}
              cards={displayData}
              metricIds={railMetricIds}
              selectedMetricId={chartMetricId}
              onSelectMetric={setSelectedMetricId}
            />
          </div>
        </div>

        <QuickActions
          geographyId={geographyId}
          geographyType={geographyType}
          geographyName={geography.name}
          userView={userView}
          stateFilter={stateFilter}
        />
      </main>

      <MobileViewToggle activeView={activeView} onViewChange={setActiveView} />
      <MarketLimitUpgradePrompt />

      <ShareMarketModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        geoLevel={geographyType}
        geoId={geographyId}
        geoName={geography.name}
        score={primaryScore?.score}
        homeValue={displayData["home_value"]?.formattedValue}
        appreciation={
          displayData["home_value"]?.percentChange != null
            ? `${displayData["home_value"].percentChange > 0 ? "+" : ""}${displayData["home_value"].percentChange.toFixed(1)}%`
            : undefined
        }
        dom={displayData["days_on_market"]?.formattedValue}
        supply={displayData["pending_ratio"]?.formattedValue}
      />

      {/* Sandbox tour value-arc spotlights. step1 highlights the PropertyIQ
          Score (data-tour="propertyiq-score" inside MetricRail); step2
          highlights the AI framing (data-tour="ai-assessment" above). */}
      <TourSpotlight stepId="step1" />
      <TourSpotlight stepId="step2" />
    </div>
  );
}
