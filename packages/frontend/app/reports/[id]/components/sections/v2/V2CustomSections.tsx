"use client";

/**
 * V2 Custom Report Sections
 *
 * Custom reports have dynamic sections — IDs aren't known at build time.
 * This component reads ai_narrative keys and renders each one using
 * the generic V2NarrativeSection component.
 */

import React from "react";
import { Sparkles, BarChart3, Layers, type LucideIcon } from "lucide-react";
import type { ReportInstance } from "../../../../types";
import { V2NarrativeSection } from "./V2NarrativeSection";

interface SectionWrapperProps {
  report: ReportInstance;
}

/** Fixed section: executive_summary */
export function V2CustomExecutiveSummary({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="executive_summary"
      title="Executive Summary"
      icon={Sparkles}
    />
  );
}

/** Fixed section: scenario_analysis */
export function V2CustomScenarioAnalysis({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="scenario_analysis"
      title="Scenario Analysis"
      icon={Layers}
    />
  );
}

/** Reserved keys that are NOT dynamic content sections */
const RESERVED_KEYS = new Set([
  "_meta",
  "__model_used",
  "executive_summary",
  "scenario_analysis",
]);

/**
 * Renders all dynamic middle sections from ai_narrative.
 * Discovers section IDs at runtime by reading the narrative keys.
 */
export function V2CustomDynamicSections({ report }: SectionWrapperProps) {
  const narrative = (report.ai_narrative ?? report.ai_narratives) as Record<
    string,
    any
  > | null;
  if (!narrative) return null;

  // Discover dynamic section IDs (everything that's not reserved and has string content)
  const dynamicIds = Object.keys(narrative).filter(
    (key) =>
      !RESERVED_KEYS.has(key) &&
      typeof narrative[key] === "string" &&
      narrative[key].length > 0,
  );

  if (dynamicIds.length === 0) return null;

  return (
    <>
      {dynamicIds.map((sectionId) => (
        <V2NarrativeSection
          key={sectionId}
          report={report}
          sectionId={sectionId}
          title={formatSectionTitle(sectionId)}
          icon={BarChart3}
        />
      ))}
    </>
  );
}

/** Convert snake_case section ID to Title Case display name */
function formatSectionTitle(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
