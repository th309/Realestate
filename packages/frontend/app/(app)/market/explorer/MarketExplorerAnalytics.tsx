"use client";
import React, { useMemo } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import { titleCaseLocationName } from "@/lib/data";
import type { SeriesByMetric } from "./lib/explorer-math";
import { buildDetailStats } from "./lib/explorer-view-model";
import type { LeaderboardRow } from "./components/Leaderboard";
import type { Mover } from "./components/TopMoversList";
import { ListingsActivityChart } from "./components/ListingsActivityChart";
import { MomentumDonut } from "./components/MomentumDonut";
import { TopMoversList } from "./components/TopMoversList";
import { CompareStrip } from "./components/CompareStrip";
import { Leaderboard } from "./components/Leaderboard";

const panelStyle: React.CSSProperties = {
  background: "var(--md-surface-container)",
  border: "1px solid var(--md-outline-variant)",
  borderRadius: 16,
  padding: "16px 18px",
};

export interface MarketExplorerAnalyticsProps {
  selected: ScopeRegion | null;
  series: SeriesByMetric;
  dates: string[];
  monthIndex: number;
  donutScores: number[];
  unitPlural: string;
  movers: Mover[];
  onSelect: (id: string) => void;
  regions: ScopeRegion[];
  pinnedIds: string[];
  scoreByRegion: Record<string, number | null>;
  geoLevel: string;
  onUnpinPin: (id: string) => void;
  onClearPins: () => void;
  boardTitle: string;
  monthLabel: string;
  rows: LeaderboardRow[];
  selectedId: string | null;
}

export function MarketExplorerAnalytics({
  selected,
  series,
  dates,
  monthIndex,
  donutScores,
  unitPlural,
  movers,
  onSelect,
  regions,
  pinnedIds,
  scoreByRegion,
  geoLevel,
  onUnpinPin,
  onClearPins,
  boardTitle,
  monthLabel,
  rows,
  selectedId,
}: MarketExplorerAnalyticsProps) {
  const pins = useMemo(
    () =>
      pinnedIds
        .map((id) => regions.find((r) => r.id === id))
        .filter((r): r is ScopeRegion => r != null)
        .map((r) => {
          const sc = Math.round(scoreByRegion[r.id] ?? 50);
          return {
            id: r.id,
            name: titleCaseLocationName(r.name),
            sub: `${geoLevel} · ${r.state}`,
            score: sc,
            scoreColor: getScoreColor(sc, 100),
            stats: buildDetailStats(series, r.id, monthIndex).slice(0, 4),
          };
        }),
    [pinnedIds, regions, scoreByRegion, geoLevel, series, monthIndex],
  );
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
          gap: 20,
        }}
      >
        <div style={panelStyle}>
          {selected && (
            <ListingsActivityChart
              title={`Listings activity — ${titleCaseLocationName(selected.name)}`}
              newListings={series.new_listings?.[selected.id] ?? []}
              pending={series.home_sales?.[selected.id] ?? []}
              months={dates}
              monthIndex={monthIndex}
            />
          )}
        </div>
        <div style={panelStyle}>
          <MomentumDonut scores={donutScores} unitPlural={unitPlural} />
        </div>
        <div style={panelStyle}>
          <TopMoversList movers={movers} onSelect={onSelect} />
        </div>
      </div>

      <CompareStrip pins={pins} onUnpin={onUnpinPin} onClear={onClearPins} />
      <Leaderboard
        title={boardTitle}
        monthLabel={monthLabel}
        rows={rows}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </>
  );
}
