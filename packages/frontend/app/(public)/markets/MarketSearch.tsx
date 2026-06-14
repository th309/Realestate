"use client";

import { useState, useMemo } from "react";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";

interface MarketSearchProps {
  metros: MetroSlugEntry[];
}

export function MarketSearch({ metros }: MarketSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");

  const states = useMemo(() => {
    return [...new Set(metros.map((m) => m.state))].sort();
  }, [metros]);

  const filtered = useMemo(() => {
    let result = metros;
    if (selectedState) {
      result = result.filter((m) => m.state === selectedState);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.shortName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [metros, query, selectedState]);

  const grouped = useMemo(() => {
    const groups: Record<string, MetroSlugEntry[]> = {};
    for (const metro of filtered) {
      const state = metro.state || "Other";
      if (!groups[state]) groups[state] = [];
      groups[state].push(metro);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search markets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 px-4 pl-10 rounded-full bg-surface-container-high border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            aria-label="Search markets by city name"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="h-12 px-4 rounded-full bg-surface-container-high border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-on-surface-variant mb-6">
        {filtered.length} {filtered.length === 1 ? "market" : "markets"} found
      </p>

      {grouped.map(([state, stateMetros]) => (
        <section key={state} className="mb-8">
          <h2 className="text-lg font-medium text-on-surface border-b border-outline-variant pb-2 mb-4">
            {state}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {stateMetros.map((metro) => (
              <a
                key={metro.slug}
                href={`/markets/${metro.slug}`}
                className="text-sm text-primary hover:text-primary/80 hover:underline py-1"
              >
                {metro.shortName}
              </a>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-on-surface-variant py-12">
          No markets match your search. Try a different city name or state.
        </p>
      )}
    </div>
  );
}
