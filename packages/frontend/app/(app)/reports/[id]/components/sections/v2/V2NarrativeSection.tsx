"use client";

import React from "react";
import { FileText, type LucideIcon } from "lucide-react";

import { SectionCard, AIAnalysisBlock } from "../core";
import type { ReportInstance } from "../../../../types";
import { getV2TextSection, getV2ActionItems } from "./narrativeVersionDetector";

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
  icon?: LucideIcon;
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
const URGENCY_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  now: { bg: "bg-red-50", text: "text-red-700", label: "Act Now" },
  soon: { bg: "bg-amber-50", text: "text-amber-700", label: "Soon" },
  watch: { bg: "bg-blue-50", text: "text-blue-700", label: "Watch" },
};

export function V2NarrativeSection({
  report,
  sectionId,
  title,
  icon = FileText,
  className = "",
}: V2NarrativeSectionProps): React.ReactElement | null {
  const content = getV2TextSection(report, sectionId);
  const actionItems = getV2ActionItems(report, sectionId);

  if (!content) return null;

  return (
    <SectionCard title={title} icon={icon} className={className}>
      <AIAnalysisBlock content={content} variant="summary" />
      {actionItems && actionItems.length > 0 && (
        <div className="mt-6 space-y-3">
          {actionItems.map((item, i) => {
            const style = URGENCY_STYLES[item.urgency] ?? URGENCY_STYLES.watch;
            return (
              <div key={i} className={`${style.bg} rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`${style.text} text-sm font-medium shrink-0 mt-0.5`}
                  >
                    {style.label}
                  </span>
                  <div>
                    <p className="font-medium text-on-surface">{item.title}</p>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
