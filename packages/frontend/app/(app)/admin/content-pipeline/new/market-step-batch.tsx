"use client";
import { useEffect, useState } from "react";
import {
  useResolvedScope,
  type ScopeSpec,
  type ScopeType,
} from "../lib/scope-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import { ScopeInput } from "./scope-input";
import { ResolvedMarketsList } from "./resolved-markets-list";

const SCOPE_LABELS: Record<ScopeType, string> = {
  metros_in_state: "All metros in state",
  zips_in_state: "All zips in state",
  zips_in_metro: "All zips in metro",
  custom: "Custom list",
};

const HARD_BATCH_CAP = 500;

export function MarketStepBatch({
  onPick,
}: {
  onPick: (markets: BatchMarket[]) => void;
}) {
  const [type, setType] = useState<ScopeType>("metros_in_state");
  const [spec, setSpec] = useState<ScopeSpec>({ type: "metros_in_state" });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useResolvedScope(spec);

  useEffect(() => {
    if (data?.markets) {
      setCheckedIds(new Set(data.markets.map((m) => m.id)));
    } else {
      setCheckedIds(new Set());
    }
  }, [data]);

  function toggleId(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function checkMany(ids: string[], on: boolean) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const checkedCount = checkedIds.size;
  const overCap = checkedCount > HARD_BATCH_CAP;

  const canSubmit = checkedCount > 0 && !overCap;

  function handleNext() {
    if (!data?.markets) return;
    const picked: BatchMarket[] = data.markets
      .filter((m) => checkedIds.has(m.id))
      .map((m) => ({
        id: m.id,
        geography: m.geography,
        canonical_name: m.canonical_name,
      }));
    onPick(picked);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
          Scope type
        </label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as ScopeType;
            setType(t);
            setSpec({ type: t });
          }}
          className="w-full rounded-full border border-outline-variant px-6 py-3 text-base bg-surface"
        >
          {(Object.keys(SCOPE_LABELS) as ScopeType[]).map((t) => (
            <option key={t} value={t}>
              {SCOPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
          Scope input
        </label>
        <ScopeInput type={type} spec={spec} onChange={setSpec} />
      </div>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Resolving scope…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-error-container/40 p-4 text-sm text-on-surface flex items-center gap-3">
          <span>
            Couldn&apos;t resolve scope:{" "}
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

      {data && data.markets.length > 0 && (
        <ResolvedMarketsList
          markets={data.markets}
          truncated={data.truncated}
          checkedIds={checkedIds}
          onToggle={toggleId}
          onCheckMany={checkMany}
        />
      )}

      {data && data.markets.length === 0 && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          No markets found in this scope.
        </div>
      )}

      {data?.unrecognized && data.unrecognized.length > 0 && (
        <div className="text-xs text-error">
          Unrecognized codes (skipped):{" "}
          <span className="font-mono">{data.unrecognized.join(", ")}</span>
        </div>
      )}

      {overCap && (
        <p className="text-xs text-error">
          Batch cap is {HARD_BATCH_CAP}. Use a narrower scope or uncheck
          markets.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canSubmit}
          className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          Next ({checkedCount} run{checkedCount === 1 ? "" : "s"})
        </button>
      </div>
    </div>
  );
}
