"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketStep({
  onPick,
  onBack,
}: {
  onPick: (market: string) => void;
  onBack: () => void;
}) {
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
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>
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
    </div>
  );
}
