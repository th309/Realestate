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
  type GeoLevel,
  isMetricSupportedForGeo,
  incrementUsageStat,
} from "@/lib/data";
import { getMetricCategories } from "@/app/map/config/metric-categories";
import { useEntitlements } from "@/lib/entitlements";
import { AIMarketAnalysis } from "./AIMarketAnalysis";
import { useQueryClient } from "@tanstack/react-query";
import { useBenchmarks } from "@/lib/benchmarks/hooks";
import { MarketLimitUpgradePrompt } from "@/components/entitlements";
import {
  DashboardHeader,
  ViewToggle,
  ScoreColumn,
  MetricCategorySection,
  QuickActions,
  MobileViewToggle,
  DashboardLoadingSpinner,
  DashboardErrorState,
  DashboardGeoGateWall,
  PREMIUM_GEO_LEVELS,
  ShareMarketModal,
} from "./components";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";

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
  const queryClient = useQueryClient();

  // Track market view for onboarding (once per geography)
  const trackedGeoRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackedGeoRef.current === geographyId) return;
    trackedGeoRef.current = geographyId;
    incrementUsageStat("markets_viewed").catch(console.error);
  }, [geographyId]);

  // Check entitlements for geography level
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

  // Derive state filter: use URL param if available
  // Note: metros don't use state filter - they can span state boundaries
  const effectiveStateFilter = useMemo(() => {
    if (geographyType === "metro") return undefined;
    if (stateFilter) return stateFilter;
    if (geographyType !== "zip" && geographyType !== "county") return undefined;
    return undefined;
  }, [stateFilter, geographyType]);

  // Single hook replaces fetchData() + useDataCardBatch() — 2 HTTP calls instead of 116
  const { cards, scores, geography, lastUpdated, isLoading, error } =
    useMarketSnapshot(geographyType, geographyId, {
      state: effectiveStateFilter,
      trendMonths: 3,
    });

  // Get metric categories for the current view (must be called before early returns)
  const categories = useMemo(() => {
    const viewMode = activeView === "investor" ? "investor" : "homebuyer";
    return getMetricCategories(viewMode).filter(
      (cat) => !cat.isDivider && cat.id !== "scores",
    );
  }, [activeView]);

  // Collect all displayed metric IDs for benchmarking
  const allMetricIds = useMemo(() => {
    return categories.flatMap((cat) =>
      (cat.metrics || [])
        .filter((m) => isMetricSupportedForGeo(m.id, geographyType as GeoLevel))
        .map((m) => m.id),
    );
  }, [categories, geographyType]);

  const { benchmarks, hasAccess: hasBenchmarkAccess } = useBenchmarks(
    geographyType,
    geographyId,
    allMetricIds,
  );

  // Apply metric fallbacks: home_value falls back to listing_price when ZHVI is unavailable
  const displayData = useMemo(() => {
    const result = { ...cards };
    if (!result["home_value"]?.value && result["listing_price"]?.value) {
      result["home_value"] = { ...result["listing_price"] };
    }
    return result;
  }, [cards]);

  const updatedDateLabel = useMemo(() => {
    if (!lastUpdated) return "Unknown";
    const parsed = new Date(lastUpdated);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString();
  }, [lastUpdated]);

  // Refresh handler
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

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        geographyId={geographyId}
        geographyName={geography.name}
        geographyType={geographyType}
        updatedDateLabel={updatedDateLabel}
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

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <ViewToggle activeView={activeView} onViewChange={setActiveView} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <ScoreColumn
            activeView={activeView}
            primaryScore={primaryScore}
            geoLevel={geographyType}
            geoId={geographyId}
          />

          {/* Right Column - Details */}
          <div className="lg:col-span-8 space-y-6">
            {/* Market Metrics by Category */}
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-4 uppercase tracking-wide">
                Market Metrics
              </h3>
              <div className="space-y-6">
                {categories.map((category, catIndex) => {
                  const supportedMetrics =
                    category.metrics
                      ?.filter((m) =>
                        isMetricSupportedForGeo(
                          m.id,
                          geographyType as GeoLevel,
                        ),
                      )
                      .map((m) => m.id) ?? [];
                  const metricsWithData = supportedMetrics.filter(
                    (id) => displayData[id] !== undefined,
                  );
                  if (metricsWithData.length === 0) return null;

                  const showDivider = catIndex === 3;

                  return (
                    <React.Fragment key={category.id}>
                      {showDivider && (
                        <hr className="border-outline-variant/40 my-2" />
                      )}
                      <MetricCategorySection
                        categoryName={category.name}
                        subtext={category.subtext}
                        icon={category.icon}
                        metricIds={metricsWithData}
                        factorsData={displayData}
                        benchmarks={benchmarks}
                        hasBenchmarkAccess={hasBenchmarkAccess}
                        delay={catIndex * 0.1}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* AI Market Analysis */}
            <div data-tour="ai-assessment">
              <AIMarketAnalysis
                geoType={geographyType}
                geoId={geographyId}
                marketName={geography.name}
                view={activeView}
                metrics={Object.fromEntries(
                  Object.entries(displayData).map(([key, card]) => [
                    key,
                    {
                      value: card.value,
                      formattedValue: card.formattedValue,
                      percentChange: card.percentChange,
                    },
                  ]),
                )}
                scores={{
                  propertyiq: scores?.propertyiq ?? null,
                }}
                lastUpdated={lastUpdated ?? new Date().toISOString()}
              />
            </div>

            <QuickActions
              geographyId={geographyId}
              geographyType={geographyType}
              geographyName={geography.name}
              userView={userView}
              stateFilter={stateFilter}
            />
          </div>
        </div>
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
    </div>
  );
}
