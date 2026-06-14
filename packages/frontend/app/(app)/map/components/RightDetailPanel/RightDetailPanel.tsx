/**
 * RightDetailPanel Component
 *
 * Analysis view panel that slides in from the right when a region is clicked.
 * Layout:
 * - Market Snapshot (key stats)
 * - Quick Actions (save, details, report)
 * - Insight Carousel (AI insights)
 * - Market Factors grid (trend data with sparklines)
 */

"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { TrendUpSmallIcon, TrendDownSmallIcon, TrendFlatIcon } from "../Icons";
import { MetricTitle } from "@/app/components/MetricTitle";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";
import type { ViewMode, SelectedGeography, GeoLevel } from "../../types";
import { useMarketFactorsData } from "../../hooks/useMarketFactorsData";
import type { AllScoresResponse, ScoreType } from "../../hooks/useScoreData";
import { InsightCarousel } from "./InsightCarousel";
import { AmbientInsight } from "./AmbientInsight";
import { MetricSelectorModal } from "./MetricSelectorModal";
import { MarketSnapshot } from "./MarketSnapshot";
import { QuickActions } from "./QuickActions";

interface MatchScoreInfo {
  matchScore: number;
  budgetMatch: boolean;
}

interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  geography: SelectedGeography | null;
  geoLevel: GeoLevel;
  /** Score data passed through from page for InsightCarousel only */
  scoreData?: AllScoresResponse | null;
  scoresLoading?: boolean;
  /** Personalized match score for the selected region */
  matchScore?: MatchScoreInfo | null;
}

interface MarketFactor {
  id: string;
  label: string;
  metricId: string;
}

type ScoreCardLike = { score?: number | null };

// Default market factors: all free-tier metrics with good coverage across geo levels
const DEFAULT_MARKET_FACTORS: MarketFactor[] = [
  { id: "appreciation", label: "Home Value YoY", metricId: "home_value_yoy" },
  { id: "dom", label: "Days on Market", metricId: "days_on_market" },
  { id: "demand", label: "Demand", metricId: "pending_ratio" },
  { id: "inventory", label: "Inventory Change", metricId: "inventory_yoy" },
];

const STORAGE_KEY = "rightpanel-market-factors";

function loadMarketFactors(): MarketFactor[] {
  if (typeof window === "undefined") return DEFAULT_MARKET_FACTORS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_MARKET_FACTORS;
  } catch {
    return DEFAULT_MARKET_FACTORS;
  }
}

export function RightDetailPanel({
  isOpen,
  onClose,
  viewMode,
  geography,
  geoLevel,
  scoreData: scoreDataProp,
  matchScore,
}: RightDetailPanelProps) {
  const [marketFactors, setMarketFactors] =
    useState<MarketFactor[]>(loadMarketFactors);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const metricIds = useMemo(
    () => [...new Set(marketFactors.map((f) => f.metricId))],
    [marketFactors],
  );
  const {
    data: factorsData,
    loading: factorsLoading,
    error: factorsError,
  } = useMarketFactorsData(metricIds, geoLevel, geography?.id ?? null, {
    months: 6,
    enabled: isOpen && !!geography,
  });

  // Handle saving market factors from modal
  const handleSaveFactors = (factors: MarketFactor[]) => {
    setMarketFactors(factors);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(factors));
    }
  };

  // Extract PropertyIQ score value for InsightCarousel
  const getPropertyIQScore = (): number | null => {
    if (!scoreDataProp) return null;
    const scoreObj = scoreDataProp.propertyiq;
    if (
      typeof scoreObj === "object" &&
      scoreObj !== null &&
      "score" in scoreObj
    ) {
      const value = (scoreObj as ScoreCardLike).score;
      return typeof value === "number" ? value : null;
    }
    return null;
  };

  if (!isOpen || !geography) return null;

  return (
    <>
      {/* M3 Scrim - Mobile overlay backdrop only */}
      <div
        className="fixed inset-0 bg-on-surface/40 z-40 md:hidden transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`
          flex flex-col bg-surface elevation-1 z-50
          fixed inset-y-0 right-0 w-full sm:w-[580px]
          md:relative md:inset-auto md:z-20 md:elevation-0 md:border-l md:border-outline-variant
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full md:hidden"}
        `}
      >
        {/* Header */}
        <div className="bg-surface border-b border-outline-variant px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-[9px] font-medium text-primary uppercase tracking-widest mb-0.5">
              Analysis View
            </p>
            <h2 className="text-lg font-bold text-on-surface">
              {geography.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* Market Snapshot */}
          <MarketSnapshot
            geoLevel={geoLevel}
            geographyId={geography.id}
            isOpen={isOpen}
          />

          {/* Market Match Score (shown when user has quiz preferences) */}
          {matchScore && (
            <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center">
                <span className="text-lg font-bold text-on-primary-container">
                  {Math.round(matchScore.matchScore)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-on-surface">
                  Your Match Score
                </p>
                <p className="text-xs text-on-surface-variant">
                  {matchScore.budgetMatch
                    ? "Within your budget"
                    : "Outside your budget range"}
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <QuickActions geography={geography} geoLevel={geoLevel} />

          {/* AI Insight */}
          <InsightCarousel
            geographyName={geography.name}
            propertyIQScore={getPropertyIQScore()}
            viewMode={viewMode === "investor" ? "investor" : "homebuyer"}
          />

          {/* Ambient AI Insight (backend-generated) */}
          <AmbientInsight geoLevel={geoLevel} regionId={geography.id} />

          {/* Market Factors Section */}
          <div
            className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant"
            onDoubleClick={() => setIsModalOpen(true)}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface">
                  Market Factors
                </h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Key elements influencing the score
                </p>
                {factorsError && (
                  <p
                    className="text-[10px] text-red-600 mt-1"
                    title={factorsError}
                  >
                    Data unavailable — check network or backend.
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Double click to edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {marketFactors
                .filter((factor) => {
                  if (factorsLoading) return true;
                  return factorsData[factor.metricId] !== undefined;
                })
                .map((factor) => {
                  const datum = factorsData[factor.metricId];

                  return (
                    <div
                      key={factor.id}
                      className="bg-surface rounded-xl p-3 border border-outline-variant flex items-center gap-2"
                    >
                      {/* Trend icon */}
                      <div
                        className={`flex-shrink-0 ${
                          datum?.trendDirection === "up"
                            ? "text-green-600"
                            : datum?.trendDirection === "down"
                              ? "text-red-500"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {datum?.trendDirection === "up" ? (
                          <TrendUpSmallIcon />
                        ) : datum?.trendDirection === "down" ? (
                          <TrendDownSmallIcon />
                        ) : (
                          <TrendFlatIcon />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide truncate">
                          <MetricTitle
                            metricId={factor.metricId}
                            resolvedMetric={{
                              source: datum?.source ?? null,
                              sourceGeoLevel: datum?.sourceGeoLevel ?? null,
                              sourceGeoId: datum?.sourceGeoId ?? null,
                              isInherited: datum?.isInherited ?? false,
                              isFallback: datum?.isFallback ?? false,
                            }}
                          />
                        </div>
                        <p className="text-xs font-bold text-on-surface mt-0.5 truncate">
                          {!datum && factorsLoading ? (
                            <span className="inline-block h-3.5 w-12 rounded bg-on-surface/10 animate-pulse" />
                          ) : (
                            (datum?.formattedValue ?? "\u2014")
                          )}
                          {datum?.trendPercent != null && (
                            <span
                              className={`text-[9px] font-normal ml-1 ${datum.trendPercent >= 0 ? "text-green-600" : "text-red-500"}`}
                            >
                              {datum.trendPercent >= 0 ? "+" : ""}
                              {datum.trendPercent.toFixed(0)}%
                            </span>
                          )}
                        </p>
                        {(datum?.isFallback ||
                          (datum?.isInherited &&
                            datum?.sourceGeoLevel &&
                            ["county", "metro", "state", "national"].includes(
                              datum.sourceGeoLevel,
                            ))) && (
                          <div className="flex items-center gap-1 mt-1">
                            {datum?.isFallback && (
                              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[8px] font-medium text-amber-700">
                                Fallback
                              </span>
                            )}
                            {datum?.isInherited &&
                              datum?.sourceGeoLevel &&
                              ["county", "metro", "state", "national"].includes(
                                datum.sourceGeoLevel,
                              ) && (
                                <InheritedBadge
                                  sourceType={
                                    datum.sourceGeoLevel as
                                      | "county"
                                      | "metro"
                                      | "state"
                                      | "national"
                                  }
                                />
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {!factorsLoading &&
                marketFactors.every((f) => !factorsData[f.metricId]) && (
                  <p className="col-span-2 text-xs text-on-surface-variant text-center py-3">
                    No market factor data available for this area.
                  </p>
                )}
            </div>
          </div>
        </div>
      </aside>

      {/* Metric Selector Modal */}
      <MetricSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentFactors={marketFactors}
        onSave={handleSaveFactors}
        maxSelections={4}
        geoLevel={geoLevel}
      />
    </>
  );
}
