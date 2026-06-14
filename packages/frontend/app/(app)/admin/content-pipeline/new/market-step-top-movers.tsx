// packages/frontend/app/admin/content-pipeline/new/market-step-top-movers.tsx
"use client";
import { useEffect, useState } from "react";
import type { BatchMarket } from "../lib/batch-runs-api";
import {
  useTopMovers,
  type ScoreMoverGeo,
  type ScoreMoverWindowDays,
} from "../lib/movers-api";
import { WindowChipPicker } from "./window-chip-picker";
import { GeoLevelRadio } from "./geo-level-radio";
import { TopMoversList } from "./top-movers-list";

const PRECHECK_PER_SIDE = 10;

function formatHumanDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function MarketStepTopMovers({
  windowDays,
  geo,
  onWindowChange,
  onGeoChange,
  onPick,
}: {
  windowDays: ScoreMoverWindowDays;
  geo: ScoreMoverGeo;
  onWindowChange: (w: ScoreMoverWindowDays) => void;
  onGeoChange: (g: ScoreMoverGeo) => void;
  onPick: (markets: BatchMarket[], windowDays: ScoreMoverWindowDays) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useTopMovers(
    geo,
    windowDays,
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data) {
      setCheckedIds(new Set());
      return;
    }
    const next = new Set<string>();
    for (const m of data.up.slice(0, PRECHECK_PER_SIDE)) next.add(m.id);
    for (const m of data.down.slice(0, PRECHECK_PER_SIDE)) next.add(m.id);
    setCheckedIds(next);
  }, [data]);

  function toggleId(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNext() {
    if (!data) return;
    const all = [...data.up, ...data.down];
    const picked: BatchMarket[] = all
      .filter((m) => checkedIds.has(m.id))
      .map((m) => ({
        id: m.id,
        geography: m.geography as "metro" | "zip",
        canonical_name: m.canonical_name,
      }));
    onPick(picked, windowDays);
  }

  const upCount = data ? data.up.filter((m) => checkedIds.has(m.id)).length : 0;
  const downCount = data
    ? data.down.filter((m) => checkedIds.has(m.id)).length
    : 0;
  const checkedCount = upCount + downCount;
  const noWindow = data?.window === null;
  const sparseBoth =
    !!data && data.window && data.up.length < 5 && data.down.length < 5;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
            Window
          </div>
          <WindowChipPicker value={windowDays} onChange={onWindowChange} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
            Geography level
          </div>
          <GeoLevelRadio value={geo} onChange={onGeoChange} />
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Resolving leaderboard…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-error-container/40 p-4 text-sm flex items-center gap-3">
          <span>
            Couldn&apos;t fetch top movers:{" "}
            <span className="font-mono text-xs">
              {(error as Error)?.message}
            </span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-xs px-3 py-1 rounded-full bg-primary text-on-primary"
          >
            Retry
          </button>
        </div>
      )}

      {data && noWindow && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm">
          No score history within ~{windowDays} days at {geo} level. Try a
          longer window.
        </div>
      )}

      {data && data.window && (
        <>
          <div className="text-xs text-on-surface-variant">
            Comparing {formatHumanDate(data.window.latestDate)} vs{" "}
            {formatHumanDate(data.window.priorDate)} · {data.qualifiedCount}{" "}
            {geo}s qualify
          </div>

          {sparseBoth && (
            <div className="text-xs text-warning">
              Sparse coverage at this window/geo. Consider widening.
            </div>
          )}

          <TopMoversList
            up={data.up}
            down={data.down}
            checkedIds={checkedIds}
            onToggle={toggleId}
          />

          <div className="flex justify-between items-center">
            <div className="text-sm text-on-surface-variant">
              {checkedCount} selected ({upCount} ▲ · {downCount} ▼)
            </div>
            <button
              type="button"
              onClick={handleNext}
              disabled={checkedCount === 0}
              className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
            >
              Next ({checkedCount} run{checkedCount === 1 ? "" : "s"})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
