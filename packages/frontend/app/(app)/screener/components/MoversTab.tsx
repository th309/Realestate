"use client";

import React from "react";
import { useScreenerMovers } from "@/lib/data";
import type { ScreenerGeoLevel, MoverWindow, ScreenerRow } from "@/lib/data";
import {
  WINDOW_META,
  getScoreChangeColor,
  formatScoreChange,
} from "../lib/score-change";

interface MoversTabProps {
  geo: ScreenerGeoLevel;
  moverWindow: MoverWindow;
  stateFilter: string;
  enabled: boolean;
}

function moverDelta(row: ScreenerRow, moverWindow: MoverWindow): number | null {
  const key = `score_chg_${moverWindow}` as keyof ScreenerRow;
  return row[key] as number | null;
}

function Leaderboard({
  title,
  rows,
  moverWindow,
}: {
  title: string;
  rows: ScreenerRow[];
  moverWindow: MoverWindow;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 bg-surface-container border-b border-outline-variant text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </div>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-on-surface-variant">
            No movers for this window.
          </li>
        ) : (
          rows.map((row, i) => {
            const d = moverDelta(row, moverWindow);
            return (
              <li
                key={`${row.geo_level}-${row.region_id}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/40 last:border-0 hover:bg-primary-container/10"
              >
                <span className="w-6 text-right font-[family-name:var(--font-roboto-mono)] text-xs text-on-surface-variant">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium text-on-surface">
                  {row.region_name}
                  {row.state_code && (
                    <span className="ml-1.5 text-xs text-on-surface-variant">
                      {row.state_code}
                    </span>
                  )}
                </span>
                <span
                  className={`font-[family-name:var(--font-roboto-mono)] text-sm font-semibold ${getScoreChangeColor(d)}`}
                >
                  {d !== null && d > 0 ? "▲ " : d !== null && d < 0 ? "▼ " : ""}
                  {formatScoreChange(d)}
                </span>
                <span className="w-8 text-right font-[family-name:var(--font-roboto-mono)] text-sm text-on-surface-variant">
                  {row.score ?? "—"}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export function MoversTab({
  geo,
  moverWindow,
  stateFilter,
  enabled,
}: MoversTabProps) {
  const { data, isFetching } = useScreenerMovers(geo, moverWindow, {
    state: stateFilter || undefined,
    limit: 25,
    enabled,
  });

  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity duration-200 ${
        isFetching ? "opacity-60" : "opacity-100"
      }`}
    >
      <Leaderboard
        title={`Top Gainers — ${WINDOW_META[moverWindow].label}`}
        rows={gainers}
        moverWindow={moverWindow}
      />
      <Leaderboard
        title={`Top Losers — ${WINDOW_META[moverWindow].label}`}
        rows={losers}
        moverWindow={moverWindow}
      />
    </div>
  );
}
