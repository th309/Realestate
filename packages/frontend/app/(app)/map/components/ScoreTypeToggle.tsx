"use client";

/**
 * ScoreTypeToggle Component
 *
 * M3 Segmented Button that switches between "PropertyIQ Score" and
 * "Your Match Score" views on the map choropleth.
 *
 * Only rendered when the user has completed the preference quiz.
 * Geo-level gating is handled by the parent via EntitlementGate.
 */

import { BarChart3, Heart } from "lucide-react";

export type ScoreViewMode = "piq" | "match";

interface ScoreTypeToggleProps {
  activeMode: ScoreViewMode;
  onChange: (mode: ScoreViewMode) => void;
  disabled?: boolean;
}

export function ScoreTypeToggle({
  activeMode,
  onChange,
  disabled = false,
}: ScoreTypeToggleProps) {
  const segments: {
    id: ScoreViewMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "piq",
      label: "PIQ Score",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: "match",
      label: "Your Match",
      icon: <Heart className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div
      className="inline-flex rounded-full border border-outline bg-surface overflow-hidden"
      role="group"
      aria-label="Score view mode"
    >
      {segments.map((segment) => {
        const isActive = activeMode === segment.id;
        return (
          <button
            key={segment.id}
            onClick={() => onChange(segment.id)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium
              transition-all duration-200
              ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            aria-pressed={isActive}
          >
            {segment.icon}
            <span className="hidden sm:inline">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
