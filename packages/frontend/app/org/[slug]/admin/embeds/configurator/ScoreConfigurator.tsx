"use client";

import { useState, useEffect } from "react";
import { GeographySearch, type GeographySelection } from "./GeographySearch";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScoreConfiguratorProps {
  onUrlChange: (url: string | null) => void;
}

const SCORE_TYPES = [
  { value: "homeready", label: "HomeReady" },
  { value: "investoredge", label: "InvestorEdge" },
  { value: "markethealth", label: "Market Health" },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScoreConfigurator({ onUrlChange }: ScoreConfiguratorProps) {
  const [scoreType, setScoreType] = useState("");
  const [geography, setGeography] = useState<GeographySelection | null>(null);

  useEffect(() => {
    if (scoreType && geography) {
      onUrlChange(
        `/embed/score/${geography.geoLevel}/${geography.id}?scoreType=${scoreType}`,
      );
    } else {
      onUrlChange(null);
    }
  }, [scoreType, geography, onUrlChange]);

  return (
    <div className="space-y-4">
      {/* Score type */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Score Type
        </label>
        <select
          value={scoreType}
          onChange={(e) => setScoreType(e.target.value)}
          className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        >
          <option value="">Select a score type...</option>
          {SCORE_TYPES.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      </div>

      {/* Geography */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Location
        </label>
        <GeographySearch
          onSelect={setGeography}
          value={geography?.name}
          placeholder="Search for a metro, county, or ZIP..."
        />
      </div>
    </div>
  );
}
