"use client";

import React from "react";
import { Target, Clock } from "lucide-react";

import { SectionCard, AIAnalysisBlock, VerdictBadge } from "../core";
import type { VerdictType } from "../core";
import type { ReportInstance } from "../../../../types";
import {
  getV2JsonSection,
  type V2VerdictAndActions,
  type V2ActionItem,
} from "./narrativeVersionDetector";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface V2VerdictActionsSectionProps {
  report: ReportInstance;
  /** The v2 section ID (e.g. 'verdict_and_actions') */
  sectionId: string;
  /** Display title for the section */
  title?: string;
  /** Score to derive the verdict badge from */
  score?: number | null;
  /** Score type for verdict labeling */
  scoreType?: "homebuyer" | "investor";
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVerdict(
  score: number | null | undefined,
  scoreType: "homebuyer" | "investor",
): { verdict: VerdictType; label: string } {
  if (score === null || score === undefined) {
    return { verdict: "cautious", label: "Insufficient Data" };
  }
  if (scoreType === "investor") {
    if (score >= 65) return { verdict: "positive", label: "Strong Investment" };
    if (score >= 45)
      return { verdict: "cautious", label: "Proceed with Caution" };
    return { verdict: "wait", label: "Wait and Watch" };
  }
  if (score >= 65) return { verdict: "positive", label: "Good Time to Buy" };
  if (score >= 45)
    return { verdict: "cautious", label: "Proceed with Caution" };
  return { verdict: "wait", label: "Wait and Watch" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a v2 verdict_and_actions section.
 *
 * Displays a verdict badge, prose verdict text, and structured action cards
 * with action name, rationale, and timeframe.
 */
export function V2VerdictActionsSection({
  report,
  sectionId,
  title = "Verdict & Actions",
  score,
  scoreType = "homebuyer",
  className = "",
}: V2VerdictActionsSectionProps): React.ReactElement | null {
  const data = getV2JsonSection<V2VerdictAndActions>(report, sectionId);

  if (!data) return null;

  const verdictText = data.verdict;
  const actions = data.actions ?? [];
  const resolvedScore =
    score ??
    (scoreType === "investor"
      ? report.investoredge_score
      : report.homeready_score);
  const { verdict, label } = getVerdict(resolvedScore, scoreType);

  return (
    <SectionCard title={title} icon={Target} className={className}>
      {/* Verdict badge */}
      <div className="flex justify-center mb-[var(--report-space-xl)]">
        <VerdictBadge
          verdict={verdict}
          label={label}
          className="text-base px-6 py-3"
        />
      </div>

      {/* Verdict prose */}
      {verdictText && (
        <div className="mb-[var(--report-space-xl)]">
          <AIAnalysisBlock content={verdictText} variant="summary" />
        </div>
      )}

      {/* Action cards */}
      {actions.length > 0 && (
        <div>
          <h3
            className="report-heading-sm mb-[var(--report-space-md)]"
            style={{ color: "var(--report-navy)" }}
          >
            Recommended Actions
          </h3>
          <div className="space-y-3">
            {actions.map((item: V2ActionItem, idx: number) => (
              <div
                key={idx}
                className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
                style={{
                  backgroundColor: "white",
                  border: "1px solid rgba(27, 46, 74, 0.08)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--report-navy)",
                      color: "white",
                      fontFamily: "var(--report-font-display)",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[0.9375rem] font-medium leading-snug mb-1"
                      style={{ color: "var(--report-navy)" }}
                    >
                      {item.action}
                    </p>
                    {item.rationale && (
                      <p
                        className="text-sm leading-relaxed mb-1.5"
                        style={{ color: "var(--report-stone)" }}
                      >
                        {item.rationale}
                      </p>
                    )}
                    {item.timeframe && (
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: "var(--report-navy-light)" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--report-navy-light)" }}
                        >
                          {item.timeframe}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
