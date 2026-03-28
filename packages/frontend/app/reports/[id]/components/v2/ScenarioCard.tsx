"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioItem {
  /** Scenario name (e.g. "Bull Case", "Base Case", "Bear Case") */
  name: string;
  /** Brief description of the scenario assumptions */
  description: string;
  /** Key metric label (e.g. "5Y Appreciation") */
  keyMetric: string;
  /** Formatted key metric value (e.g. "+32%", "$485K") */
  keyValue: string;
  /** What this scenario means for the buyer/investor */
  implication: string;
}

export interface V2ScenarioCardProps {
  /** Array of scenario items to compare (typically 2-3) */
  scenarios: ScenarioItem[];
  /** Optional title override */
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines the accent color for each scenario position.
 * First scenario = conservative/blue, middle = neutral, last = optimistic/green.
 */
function getScenarioAccent(
  index: number,
  total: number,
): {
  borderClass: string;
  badgeClass: string;
  valueBgClass: string;
} {
  if (total <= 1) {
    return {
      borderClass: "border-[var(--report-gold)]",
      badgeClass: "bg-indigo-50 text-indigo-700",
      valueBgClass: "bg-indigo-50",
    };
  }
  if (index === 0) {
    return {
      borderClass: "border-blue-400",
      badgeClass: "bg-blue-50 text-blue-700",
      valueBgClass: "bg-blue-50",
    };
  }
  if (index === total - 1) {
    return {
      borderClass: "border-emerald-400",
      badgeClass: "bg-emerald-50 text-emerald-700",
      valueBgClass: "bg-emerald-50",
    };
  }
  return {
    borderClass: "border-amber-400",
    badgeClass: "bg-amber-50 text-amber-700",
    valueBgClass: "bg-amber-50",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScenarioTile({
  scenario,
  accent,
}: {
  scenario: ScenarioItem;
  accent: ReturnType<typeof getScenarioAccent>;
}) {
  return (
    <div
      className={`report-card p-5 border-t-4 ${accent.borderClass} flex flex-col`}
    >
      {/* Scenario Name Badge */}
      <span
        className={`inline-flex self-start px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-3 ${accent.badgeClass}`}
      >
        {scenario.name}
      </span>

      {/* Description */}
      <p className="text-sm text-[var(--report-stone)] leading-relaxed mb-4">
        {scenario.description}
      </p>

      {/* Key Metric Highlight */}
      <div className={`rounded-xl p-4 ${accent.valueBgClass} mb-4`}>
        <p className="report-metric-label">{scenario.keyMetric}</p>
        <p className="report-metric-value text-2xl mt-1">{scenario.keyValue}</p>
      </div>

      {/* Implication */}
      <div className="mt-auto pt-3 border-t border-[rgba(29,27,32,0.06)]">
        <div className="flex items-start gap-2">
          <ArrowRight className="w-4 h-4 text-[var(--report-stone-light)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--report-stone)] leading-relaxed">
            {scenario.implication}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * V2ScenarioCard - Visual comparison card for scenario analysis sections.
 *
 * Displays side-by-side scenario cards with color-coded accents,
 * key metric highlights, and implication callouts. Each scenario
 * gets a distinct visual treatment to emphasize the delta between them.
 *
 * @example
 * ```tsx
 * <V2ScenarioCard
 *   title="Investment Scenarios"
 *   scenarios={[
 *     {
 *       name: 'Bear Case',
 *       description: 'Rates stay elevated, demand softens',
 *       keyMetric: '5Y Total Return',
 *       keyValue: '+8%',
 *       implication: 'Positive but below historical averages',
 *     },
 *     {
 *       name: 'Base Case',
 *       description: 'Gradual rate normalization',
 *       keyMetric: '5Y Total Return',
 *       keyValue: '+24%',
 *       implication: 'In line with long-term metro averages',
 *     },
 *     {
 *       name: 'Bull Case',
 *       description: 'Strong job growth, rate cuts accelerate',
 *       keyMetric: '5Y Total Return',
 *       keyValue: '+42%',
 *       implication: 'Significant upside with strong fundamentals',
 *     },
 *   ]}
 * />
 * ```
 */
export function V2ScenarioCard({
  scenarios,
  title = "Scenario Analysis",
}: V2ScenarioCardProps): React.ReactElement {
  const gridCols =
    scenarios.length === 2
      ? "md:grid-cols-2"
      : scenarios.length >= 3
        ? "md:grid-cols-3"
        : "";

  return (
    <div className="my-6">
      <h3 className="report-heading-sm mb-4">{title}</h3>
      <div className={`grid gap-4 ${gridCols}`}>
        {scenarios.map((scenario, index) => (
          <ScenarioTile
            key={scenario.name}
            scenario={scenario}
            accent={getScenarioAccent(index, scenarios.length)}
          />
        ))}
      </div>
    </div>
  );
}
