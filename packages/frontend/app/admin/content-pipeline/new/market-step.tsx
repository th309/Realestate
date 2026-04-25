"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import type { WizardMode } from "./page";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketStep({
  mode,
  onModeChange,
  onPickSingle,
  onPickBatch,
  onBack,
}: {
  mode: WizardMode;
  onModeChange: (mode: WizardMode) => void;
  onPickSingle: (market: string) => void;
  onPickBatch: (markets: BatchMarket[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>

      <ModeToggle mode={mode} onChange={onModeChange} />

      {mode === "single" ? (
        <SingleMarketBody onPick={onPickSingle} />
      ) : (
        <BatchPlaceholder onPick={onPickBatch} />
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: WizardMode;
  onChange: (m: WizardMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1 mb-6"
      role="radiogroup"
    >
      {(["single", "batch"] as WizardMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {m === "single" ? "Single market" : "Batch"}
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

function BatchPlaceholder({
  onPick,
}: {
  onPick: (markets: BatchMarket[]) => void;
}) {
  void onPick;
  return (
    <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
      Batch mode is being wired up in the next implementation step. Switch back
      to <strong>Single market</strong> for now.
    </div>
  );
}
