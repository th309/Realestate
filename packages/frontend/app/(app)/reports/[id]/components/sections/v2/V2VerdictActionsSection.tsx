"use client";

import React from "react";
import { Target, Clock } from "lucide-react";

import { SectionCard, AIAnalysisBlock, VerdictBadge } from "../core";
import type { VerdictType } from "../core";
import type { ReportInstance } from "../../../../types";
import { getV2Section } from "./narrativeVersionDetector";

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
  // The backend stores verdict_and_actions as { narrative, action_items } (the
  // ACTION_ITEMS_JSON parse) or, when no actions were emitted, a plain STRING —
  // NOT { verdict, actions }. Read every shape so the section is never blank or
  // dropped (the prior getV2JsonSection<{verdict,actions}> read produced empty
  // prose for objects and null — dropping the section — for strings).
  const raw = getV2Section(report, sectionId);
  let verdictText = "";
  let actions: Array<Record<string, string | undefined>> = [];
  if (typeof raw === "string") {
    verdictText = raw;
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    verdictText = (
      (o.narrative as string) ??
      (o.verdict as string) ??
      ""
    ).trim();
    const list = (o.action_items ?? o.actions) as unknown;
    if (Array.isArray(list))
      actions = list as Array<Record<string, string | undefined>>;
  }

  if (!verdictText && actions.length === 0) return null;

  // The verdict badge reads the LIVE PropertyIQ score — the legacy
  // homeready/investoredge fields are retired (null), which is what produced the
  // "Insufficient Data" badge.
  const piqScore = (
    report.populated_data as {
      scores?: { propertyiq?: { score?: number } };
    } | null
  )?.scores?.propertyiq?.score;
  const resolvedScore =
    score ??
    (typeof piqScore === "number" ? piqScore : null) ??
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
            {actions.map((item, idx: number) => {
              // Action items arrive with varying keys depending on the prompt:
              // {action, rationale, timeframe} OR {action|title, detail, urgency}.
              const actionLabel = item.action ?? item.title ?? "";
              const rationale = item.rationale ?? item.detail ?? "";
              const timeframe = item.timeframe ?? item.urgency ?? "";
              if (!actionLabel) return null;
              return (
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
                        {actionLabel}
                      </p>
                      {rationale && (
                        <p
                          className="text-sm leading-relaxed mb-1.5"
                          style={{ color: "var(--report-stone)" }}
                        >
                          {rationale}
                        </p>
                      )}
                      {timeframe && (
                        <div className="flex items-center gap-1.5">
                          <Clock
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: "var(--report-navy-light)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--report-navy-light)" }}
                          >
                            {timeframe}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
