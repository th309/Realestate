"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import type { ScoreMoverGeo, ScoreMoverWindowDays } from "../lib/movers-api";
import type { WizardFormatOptions, WizardMode } from "./page";
import { MarketStepBatch } from "./market-step-batch";
import { MarketStepTopMovers } from "./market-step-top-movers";
import { WindowChipPicker } from "./window-chip-picker";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketStep({
  format,
  mode,
  onModeChange,
  formatOptions,
  onFormatOptionsChange,
  topMoversGeo,
  onTopMoversGeoChange,
  onPickSingle,
  onPickBatch,
  onPickTopMovers,
  onBack,
}: {
  format: string;
  mode: WizardMode;
  onModeChange: (mode: WizardMode) => void;
  formatOptions: WizardFormatOptions;
  onFormatOptionsChange: (opts: WizardFormatOptions) => void;
  topMoversGeo: ScoreMoverGeo;
  onTopMoversGeoChange: (g: ScoreMoverGeo) => void;
  onPickSingle: (market: string) => void;
  onPickBatch: (markets: BatchMarket[]) => void;
  onPickTopMovers: (
    markets: BatchMarket[],
    windowDays: ScoreMoverWindowDays,
  ) => void;
  onBack: () => void;
}) {
  const isScoreMover = format === "score_mover";
  const windowDays = formatOptions.windowDays ?? 90;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>

      <ModeToggle
        mode={mode}
        onChange={onModeChange}
        showTopMovers={isScoreMover}
      />

      {isScoreMover && mode === "single" && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-on-surface-variant">
            Window
          </span>
          <WindowChipPicker
            value={windowDays}
            onChange={(w) =>
              onFormatOptionsChange({ ...formatOptions, windowDays: w })
            }
          />
        </div>
      )}

      {mode === "single" && <SingleMarketBody onPick={onPickSingle} />}
      {mode === "batch" && <MarketStepBatch onPick={onPickBatch} />}
      {mode === "top_movers" && (
        <MarketStepTopMovers
          windowDays={windowDays}
          geo={topMoversGeo}
          onWindowChange={(w) =>
            onFormatOptionsChange({ ...formatOptions, windowDays: w })
          }
          onGeoChange={onTopMoversGeoChange}
          onPick={onPickTopMovers}
        />
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  showTopMovers,
}: {
  mode: WizardMode;
  onChange: (m: WizardMode) => void;
  showTopMovers: boolean;
}) {
  const modes: WizardMode[] = showTopMovers
    ? ["single", "batch", "top_movers"]
    : ["single", "batch"];
  const labels: Record<WizardMode, string> = {
    single: "Single market",
    batch: "Batch",
    top_movers: "Top movers",
  };
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1 mb-6"
      role="radiogroup"
    >
      {modes.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {labels[m]}
          </button>
        );
      })}
    </div>
  );
}

function SingleMarketBody({ onPick }: { onPick: (market: string) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MarketMatch[]>([]);

  async function handleChange(v: string) {
    setQuery(v);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    setMatches(m as MarketMatch[]);
  }

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Cleveland, Miami, 78704..."
        className="w-full rounded-full border border-outline-variant px-6 py-4 text-lg"
        autoFocus
      />
      <div className="mt-4 space-y-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.canonical_name)}
            className="block w-full text-left p-4 rounded-lg hover:bg-surface-container-low"
          >
            <div className="font-medium">{m.canonical_name}</div>
            <div className="text-xs text-outline">
              {m.geography} {m.state ? `, ${m.state}` : ""}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
