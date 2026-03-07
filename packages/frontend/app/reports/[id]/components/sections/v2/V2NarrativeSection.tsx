"use client";

import React from "react";
import { FileText } from "lucide-react";

import { SectionCard, AIAnalysisBlock } from "../core";
import type { ReportInstance } from "../../../../types";
import { getV2TextSection } from "./narrativeVersionDetector";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface V2NarrativeSectionProps {
  report: ReportInstance;
  /** The v2 section ID to read from ai_narrative (e.g. 'market_deep_dive') */
  sectionId: string;
  /** Display title for the section */
  title: string;
  /** Lucide icon component to show in the section header */
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a v2 text narrative section.
 *
 * Reads from `report.ai_narrative[sectionId]` and displays as prose
 * paragraphs within a SectionCard. Used for sections like:
 * - executive_verdict
 * - market_deep_dive / investment_deep_dive
 * - your_situation
 * - risk_and_resilience
 * - investment_thesis
 * - head_to_head
 * - scenario_analysis
 */
export function V2NarrativeSection({
  report,
  sectionId,
  title,
  icon = FileText,
  className = "",
}: V2NarrativeSectionProps): React.ReactElement | null {
  const content = getV2TextSection(report, sectionId);

  if (!content) return null;

  return (
    <SectionCard title={title} icon={icon} className={className}>
      <AIAnalysisBlock content={content} variant="summary" />
    </SectionCard>
  );
}
