"use client";

import { piq } from "./piqTokens";
import {
  VerdictBody,
  VerdictLocked,
  VerdictSkeleton,
} from "./DealGradeVerdict";

export type DealGradeLetter =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

export type DealGradeStrategy = "buy-hold" | "flip" | "brrrr" | "multifamily";

export type DealGradeProps = {
  grade: DealGradeLetter;
  qualifier: string;
  aiVerdict?: string | null;
  isStreaming?: boolean;
  isPro: boolean;
  strategy: DealGradeStrategy;
  onUpgrade?: () => void;
  /** When true, render a neutral placeholder instead of a graded result. */
  pending?: boolean;
};

const STRATEGY_LABEL: Record<DealGradeStrategy, string> = {
  "buy-hold": "BUY & HOLD",
  flip: "FLIP",
  brrrr: "BRRRR",
  multifamily: "MULTIFAMILY",
};

const SERIF_STACK =
  '"Fraunces", "Source Serif 4", "Georgia", "Times New Roman", serif';

function gradeColor(grade: DealGradeLetter): string {
  const base = grade.charAt(0);
  if (base === "A") return piq.green;
  if (base === "B") return piq.teal;
  if (base === "C") return piq.amber;
  if (base === "D") return piq.orange;
  return piq.red; // F
}

function splitGrade(grade: DealGradeLetter): {
  base: string;
  modifier: "+" | "−" | null;
} {
  const base = grade.charAt(0);
  if (grade.length === 1) return { base, modifier: null };
  const mod = grade.charAt(1);
  return { base, modifier: mod === "+" ? "+" : "−" };
}

export function DealGrade({
  grade,
  qualifier,
  aiVerdict,
  isStreaming = false,
  isPro,
  strategy,
  onUpgrade,
  pending = false,
}: DealGradeProps) {
  const color = pending ? piq.textMuted : gradeColor(grade);
  const { base, modifier } = pending
    ? { base: "—", modifier: null as null }
    : splitGrade(grade);
  const displayQualifier = pending ? "Enter address to score" : qualifier;
  const strategyLabel = STRATEGY_LABEL[strategy];

  return (
    <div
      data-deal-grade
      data-grade={grade}
      data-strategy={strategy}
      className="rounded-2xl overflow-hidden"
      style={{
        background: piq.surface,
        border: `0.5px solid ${piq.border}`,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[3fr_7fr]">
        {/* Left: letter grade */}
        <div
          role="img"
          aria-label={
            pending ? "No deal scored yet" : `Deal grade ${grade}: ${qualifier}`
          }
          className="px-6 py-8 md:px-8 flex flex-col items-center justify-center text-center"
          style={{ borderRight: `0.5px solid ${piq.border}` }}
        >
          <div
            aria-hidden
            style={{
              fontFamily: SERIF_STACK,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color,
              display: "inline-flex",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontSize: "96px" }}>{base}</span>
            {modifier && (
              <span style={{ fontSize: "57.6px", marginLeft: "2px" }}>
                {modifier}
              </span>
            )}
          </div>
          <div
            className="mt-3"
            style={{
              fontSize: "16px",
              color: piq.textMuted,
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            {displayQualifier}
          </div>
          <div
            className="mt-4 inline-flex items-center rounded-full"
            style={{
              background: piq.canvas,
              border: `0.5px solid ${piq.border}`,
              fontSize: "11px",
              letterSpacing: "0.14em",
              color: piq.textMuted,
              fontWeight: 600,
              padding: "4px 10px",
            }}
          >
            {strategyLabel}
          </div>
        </div>

        {/* Right: AI verdict */}
        <div className="px-6 py-8 md:px-8 flex flex-col gap-3 justify-center">
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.14em",
              color: piq.textMuted,
              fontWeight: 600,
            }}
          >
            AI DEAL COACH
          </div>

          {pending && (
            <div
              style={{
                fontSize: "14px",
                color: piq.textMuted,
                lineHeight: 1.5,
              }}
            >
              Enter a property address to get a graded analysis and AI deal
              coach.
            </div>
          )}
          {!pending && !isPro && <VerdictLocked onUpgrade={onUpgrade} />}
          {!pending && isPro && !aiVerdict && <VerdictSkeleton />}
          {!pending && isPro && aiVerdict && (
            <VerdictBody text={aiVerdict} isStreaming={isStreaming} />
          )}
        </div>
      </div>
    </div>
  );
}
