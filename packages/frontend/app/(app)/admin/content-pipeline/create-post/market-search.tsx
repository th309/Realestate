"use client";

import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

/**
 * Typeahead over the shared `resolveMarket` endpoint (the same resolver the run
 * wizard uses). Calls `onPick` with the canonical market name — the string the
 * generate endpoint grounds on. Purely a picker: the parent owns the chosen
 * value and renders the "selected" state.
 */
export function MarketSearch({
  onPick,
}: {
  onPick: (marketQuery: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      const result = await resolveMarket(value);
      setMatches(result as MarketMatch[]);
    } catch {
      setMatches([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Cleveland, Miami, 78704..."
        className="w-full rounded-full border border-outline-variant bg-surface px-6 py-4 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        autoFocus
      />

      {searching && matches.length === 0 && query.trim().length >= 2 && (
        <p className="mt-3 text-sm text-on-surface-variant">Searching…</p>
      )}

      {matches.length > 0 && (
        <div className="mt-3 space-y-1">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.canonical_name)}
              className="block w-full rounded-lg p-3 text-left transition-colors duration-200 hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="font-medium text-on-surface">
                {m.canonical_name}
              </div>
              <div className="text-xs text-outline">
                {m.geography}
                {m.state ? `, ${m.state}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
