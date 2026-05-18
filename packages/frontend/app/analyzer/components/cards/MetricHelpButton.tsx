"use client";

/**
 * Inline ? button next to a metric label. Click toggles a popover with the
 * metric's definition, formula, why-it-matters, and industry standards.
 *
 * Replaces the purely decorative <InfoIcon /> that used to sit next to each
 * metric label in ScoreBreakdownTable. The icon styling is preserved so the
 * table layout is unchanged when no metric has help content.
 *
 * Popover behavior:
 *   - Click the ? to open; click anywhere outside (or press Escape) to close.
 *   - Anchored to the button via absolute positioning inside a relative
 *     wrapper. Width capped at 320px so the popover reads as a tooltip card
 *     even on narrow tables.
 *   - Only one popover is open at a time per tree because each row has its
 *     own MetricHelpButton with its own state; clicking a second ? closes
 *     the first via React's render cycle (the previously-open instance
 *     re-renders with `open={false}` once the click hits document).
 */

import { useEffect, useRef, useState } from "react";
import type { MetricHelp } from "../../lib/metric-help";

interface MetricHelpButtonProps {
  help: MetricHelp | null;
  metricLabel: string;
}

export function MetricHelpButton({ help, metricLabel }: MetricHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        e.target instanceof Node &&
        !wrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // No help content registered for this metric — render the icon as a static
  // decoration so the table layout is consistent.
  if (!help) {
    return (
      <span
        aria-hidden
        className="inline-flex items-center ml-1 text-on-surface-variant/30"
      >
        <QuestionIcon />
      </span>
    );
  }

  return (
    <span
      ref={wrapperRef}
      data-metric-help-wrapper
      className="relative inline-flex items-center ml-1"
    >
      <button
        type="button"
        aria-label={`What is ${metricLabel}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-full text-on-surface-variant/60 hover:text-[var(--md-primary)] focus:outline-none focus:text-[var(--md-primary)] transition-colors cursor-pointer"
      >
        <QuestionIcon />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${metricLabel} — help`}
          data-metric-help-popover
          className="absolute z-20 top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-outline-variant bg-surface shadow-lg p-4 text-left"
          style={{ fontSize: "13px", lineHeight: 1.5 }}
        >
          <header className="mb-2">
            <h4 className="text-sm font-semibold text-on-surface leading-tight">
              {help.title}
            </h4>
          </header>
          <p className="text-on-surface-variant mb-3">{help.definition}</p>
          {help.formula && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-1">
                Formula
              </div>
              <code
                className="block rounded-md bg-surface-container-low px-2 py-1.5 text-[12px] font-mono text-on-surface"
                style={{ wordBreak: "break-word" }}
              >
                {help.formula}
              </code>
            </div>
          )}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-1">
              Why it matters
            </div>
            <p className="text-on-surface">{help.whyItMatters}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-1">
              Industry standards
            </div>
            <p className="text-on-surface">{help.standards}</p>
          </div>
        </div>
      )}
    </span>
  );
}

function QuestionIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 16 16"
      className="inline-block"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <text
        x="8"
        y="11.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="currentColor"
      >
        ?
      </text>
    </svg>
  );
}
