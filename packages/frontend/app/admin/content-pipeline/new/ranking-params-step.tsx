"use client";

import { useState, useEffect } from "react";
import { METRICS } from "@/lib/data/registry";
import { isMetricSupportedForGeo } from "@/lib/data/registry-helpers";
import {
  validLevelsForScope,
  type GeoLevel,
  type ScopeType,
} from "./helpers/ranking-validity";
import { resolveMarket } from "../lib/content-pipeline-api";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const US_STATES: Array<{ abbr: string; name: string }> = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
  { abbr: "DC", name: "District of Columbia" },
];

const GEO_LEVEL_LABELS: Record<GeoLevel, string> = {
  metro: "Metros",
  county: "Counties",
  zip: "ZIP Codes",
};

const SCOPE_LABELS: Record<ScopeType, string> = {
  national: "National",
  state: "State",
  metro: "Metro",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

interface Props {
  format: "top_10_ranking" | "bottom_10_ranking";
  initial?: Partial<{
    metric_id: string;
    geo_level: GeoLevel;
    scope_type: ScopeType;
    scope_id: string | null;
  }>;
  onBack: () => void;
  onNext: (params: {
    metric_id: string;
    geo_level: GeoLevel;
    scope_type: ScopeType;
    scope_id: string | null;
  }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RankingParamsStep({ format, initial, onBack, onNext }: Props) {
  const [metricId, setMetricId] = useState(initial?.metric_id ?? "");
  const [scopeType, setScopeType] = useState<ScopeType>(
    initial?.scope_type ?? "national",
  );
  const [scopeId, setScopeId] = useState<string | null>(
    initial?.scope_id ?? null,
  );
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(
    initial?.geo_level ?? "metro",
  );

  // Recompute allowed levels whenever metric or scope changes
  const allowedLevels = validLevelsForScope(scopeType).filter(
    (lvl) => !metricId || isMetricSupportedForGeo(metricId, lvl),
  );

  // Snap geoLevel when it falls outside allowedLevels
  useEffect(() => {
    if (allowedLevels.length > 0 && !allowedLevels.includes(geoLevel)) {
      setGeoLevel(allowedLevels[0]);
    }
  }, [allowedLevels, geoLevel]);

  // Reset scopeId when scope type changes
  function handleScopeTypeChange(next: ScopeType) {
    setScopeType(next);
    setScopeId(null);
  }

  const canSubmit =
    !!metricId &&
    allowedLevels.length > 0 &&
    (scopeType === "national" || !!scopeId);

  const isTop = format === "top_10_ranking";
  const headingLabel = isTop ? "Top 10" : "Bottom 10";

  const allMetrics = Object.values(METRICS);

  function handleSubmit() {
    if (!canSubmit) return;
    onNext({
      metric_id: metricId,
      geo_level: geoLevel,
      scope_type: scopeType,
      scope_id: scopeId,
    });
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>

      <h1 className="text-2xl font-semibold mb-8">
        {headingLabel} — Configure ranking
      </h1>

      {/* Metric picker */}
      <section className="mb-8">
        <label className="block text-sm font-semibold mb-2">What metric?</label>
        <select
          value={metricId}
          onChange={(e) => setMetricId(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a metric…</option>
          {allMetrics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </section>

      {/* Geo level picker */}
      <section className="mb-8">
        <label className="block text-sm font-semibold mb-2">What level?</label>
        {allowedLevels.length === 0 ? (
          <p className="text-sm text-outline italic">
            No geography levels available for the selected metric and scope.
          </p>
        ) : (
          <div
            className="flex gap-4"
            role="radiogroup"
            aria-label="Geography level"
          >
            {allowedLevels.map((lvl) => {
              const active = geoLevel === lvl;
              return (
                <label
                  key={lvl}
                  className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 ${
                    active
                      ? "bg-primary text-on-primary border-primary"
                      : "border-outline-variant text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <input
                    type="radio"
                    name="geo_level"
                    value={lvl}
                    checked={active}
                    onChange={() => setGeoLevel(lvl)}
                    className="sr-only"
                  />
                  {GEO_LEVEL_LABELS[lvl]}
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* Scope picker */}
      <section className="mb-10">
        <label className="block text-sm font-semibold mb-2">Where?</label>

        {/* Segmented control */}
        <div
          className="inline-flex rounded-full bg-surface-container-low p-1 mb-4"
          role="radiogroup"
          aria-label="Scope"
        >
          {(["national", "state", "metro"] as ScopeType[]).map((s) => {
            const active = scopeType === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleScopeTypeChange(s)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  active
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                {SCOPE_LABELS[s]}
              </button>
            );
          })}
        </div>

        {/* Contextual sub-picker */}
        {scopeType === "state" && (
          <StateSelector value={scopeId} onChange={setScopeId} />
        )}
        {scopeType === "metro" && (
          <MetroSearch value={scopeId} onChange={setScopeId} />
        )}
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 rounded-full border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors duration-200"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-6 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
        >
          Preview →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-pickers
// ---------------------------------------------------------------------------

function StateSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">Select a state…</option>
      {US_STATES.map((s) => (
        <option key={s.abbr} value={s.abbr}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function MetroSearch({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [selected, setSelected] = useState<MarketMatch | null>(null);

  async function handleQueryChange(v: string) {
    setQuery(v);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const results = (await resolveMarket(v)) as MarketMatch[];
    // Only show metros
    setMatches(results.filter((r) => r.geography === "metro"));
  }

  function handleSelect(m: MarketMatch) {
    setSelected(m);
    setQuery(m.canonical_name);
    setMatches([]);
    onChange(m.id);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setMatches([]);
    onChange(null);
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            if (selected) handleClear();
            handleQueryChange(e.target.value);
          }}
          placeholder="New York, Los Angeles…"
          className="w-full rounded-full border border-outline-variant px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-lg leading-none"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-outline-variant bg-surface shadow-md overflow-hidden">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m)}
              className="block w-full text-left px-4 py-3 text-sm hover:bg-surface-container-low"
            >
              <span className="font-medium">{m.canonical_name}</span>
              {m.state && (
                <span className="ml-2 text-xs text-outline">{m.state}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
