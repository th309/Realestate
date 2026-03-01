"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, Trophy, Hash } from "lucide-react";
import { useTopMarkets } from "@/lib/data/hooks/useTopMarkets";
import { US_STATES } from "@/app/map/types";
import type { TopMarketsGeo, TopMarketsScoreType } from "@/lib/data";
import { addRecentMarket } from "./recent-markets";

const GEO_TABS: { value: TopMarketsGeo; label: string }[] = [
  { value: "metro", label: "Metros" },
  { value: "county", label: "Counties" },
  { value: "zip", label: "Zips" },
];

const SCORE_TABS: { value: TopMarketsScoreType; label: string }[] = [
  { value: "investoredge", label: "InvestorEdge" },
  { value: "homeready", label: "HomeReady" },
  { value: "markethealth", label: "Market Health" },
];

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function getGradeColor(grade: string): string {
  if (!grade) return "text-on-surface-variant";
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "text-green-600 dark:text-green-400";
  if (g.startsWith("B")) return "text-blue-600 dark:text-blue-400";
  if (g.startsWith("C")) return "text-amber-600 dark:text-amber-400";
  if (g.startsWith("D")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-500/10";
  if (score >= 60) return "bg-blue-500/10";
  if (score >= 40) return "bg-amber-500/10";
  if (score >= 20) return "bg-orange-500/10";
  return "bg-red-500/10";
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return "text-green-700 dark:text-green-400";
  if (score >= 60) return "text-blue-700 dark:text-blue-400";
  if (score >= 40) return "text-amber-700 dark:text-amber-400";
  if (score >= 20) return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
}

export function TopMarketsSection() {
  const [geo, setGeo] = useState<TopMarketsGeo>("metro");
  const [scoreType, setScoreType] =
    useState<TopMarketsScoreType>("investoredge");
  const [limit, setLimit] = useState<number>(10);
  const [stateFilter, setStateFilter] = useState<string>("");

  const { data, isLoading, error } = useTopMarkets({
    geography: geo,
    scoreType,
    limit,
    state: stateFilter || undefined,
  });

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-on-surface-variant mb-4">
        <Trophy className="w-5 h-5" />
        <h2 className="text-lg font-medium text-on-surface">Top Markets</h2>
      </div>

      {/* Controls */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden">
        {/* Controls row: geo + score + state + limit */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-3 sm:p-4 border-b border-outline-variant flex-wrap">
          {/* Geography tabs */}
          <div className="flex bg-surface-container-high rounded-lg p-0.5">
            {GEO_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setGeo(tab.value)}
                className={`px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  geo === tab.value
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-outline-variant hidden sm:block" />

          {/* Score type tabs */}
          <div className="flex bg-surface-container-high rounded-lg p-0.5">
            {SCORE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setScoreType(tab.value)}
                className={`px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  scoreType === tab.value
                    ? "bg-tertiary text-on-tertiary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-outline-variant hidden sm:block" />

          {/* State filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-2 py-1 text-xs sm:text-sm rounded-lg border border-outline bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s.abbrev} value={s.abbrev}>
                {s.abbrev}
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-outline-variant hidden sm:block" />

          {/* Limit selector */}
          <div className="flex bg-surface-container-high rounded-lg p-0.5">
            {LIMIT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  limit === n
                    ? "bg-secondary text-on-secondary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="divide-y divide-outline-variant">
          {isLoading ? (
            Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 animate-pulse"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-container-high" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 bg-surface-container-high rounded" />
                  <div className="h-3 w-24 bg-surface-container-high rounded" />
                </div>
                <div className="h-6 w-12 bg-surface-container-high rounded" />
              </div>
            ))
          ) : error ? (
            <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
              Failed to load rankings. Please try again.
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
              No ranked markets available for this selection.
            </div>
          ) : (
            data.map((market, index) => (
              <Link
                key={market.location_id}
                href={`/market/${market.location_id}?type=${geo}&view=investor`}
                onClick={() =>
                  addRecentMarket({
                    id: market.location_id,
                    name: market.location_name,
                    type: geo,
                  })
                }
                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-sm font-semibold text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {market.location_name}
                  </div>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums ${getScoreBgColor(market.score)} ${getScoreTextColor(market.score)}`}
                >
                  {market.score.toFixed(1)}
                </div>
                <div
                  className={`text-sm font-bold w-8 text-center ${getGradeColor(market.grade)}`}
                >
                  {market.grade}
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
