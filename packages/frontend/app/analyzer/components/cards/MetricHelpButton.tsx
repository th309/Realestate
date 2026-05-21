"use client";

/**
 * Inline ? button next to a metric label. Opens on hover (with a tiny enter
 * delay so quick mouse-overs don't flicker) and on click for touch devices.
 *
 * Why a portal: the score breakdown table sits inside a `rounded-2xl
 * overflow-hidden` container. A position: absolute popover gets clipped by
 * that overflow. Rendering through createPortal to document.body escapes
 * every stacking + clipping context on the page, and z-[1000] keeps the
 * popover above the customize drawer (z-50) and any other layered chrome.
 *
 * The popover position tracks the button via getBoundingClientRect on open
 * + a scroll/resize listener while open. Always anchored just below the
 * button; flips horizontally when it would overflow the viewport right edge.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { MetricHelp } from "../../lib/metric-help";

interface MetricHelpButtonProps {
  help: MetricHelp | null;
  metricLabel: string;
}

/** Delay before hover-leave closes the popover. Gives the user a moment to
 *  move the cursor from the button down to the popover content. */
const HOVER_CLOSE_DELAY_MS = 150;
const POPOVER_WIDTH = 320;
const POPOVER_OFFSET = 8;

export function MetricHelpButton({ help, metricLabel }: MetricHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  // Position the popover under the button on open. Recompute on scroll /
  // resize so a long page that scrolls while the popover is open keeps it
  // glued to the button.
  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const viewportRight = window.innerWidth - 8;
    let left = rect.left;
    if (left + POPOVER_WIDTH > viewportRight) {
      left = Math.max(8, viewportRight - POPOVER_WIDTH);
    }
    setCoords({ top: rect.bottom + POPOVER_OFFSET, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on Escape. Click-outside is handled implicitly by the hover-leave
  // path; touch users tapping outside hit a different DOM node and the
  // popover stays open until they tap the ? again or hit Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Cleanup any pending close on unmount.
  useEffect(() => {
    return () => cancelClose();
  }, [cancelClose]);

  // No help content — render the icon as a dimmed static decoration so the
  // table layout is consistent across metrics with and without help entries.
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
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`What is ${metricLabel}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        className="inline-flex items-center justify-center ml-1 rounded-full text-on-surface-variant/60 hover:text-[var(--md-primary)] focus:outline-none focus:text-[var(--md-primary)] transition-colors cursor-pointer"
      >
        <QuestionIcon />
      </button>
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${metricLabel} — help`}
            data-metric-help-popover
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="fixed rounded-xl border border-outline-variant bg-surface shadow-lg p-4 text-left"
            style={{
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              maxWidth: "calc(100vw - 16px)",
              fontSize: "13px",
              lineHeight: 1.5,
              zIndex: 1000,
            }}
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
          </div>,
          document.body,
        )}
    </>
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
