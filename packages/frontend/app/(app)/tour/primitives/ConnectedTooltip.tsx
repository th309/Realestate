"use client";

import { useEffect, useState, useCallback, useRef, useId } from "react";
import type { OnboardingStep } from "./types";

interface ConnectedTooltipProps {
  step: OnboardingStep;
  currentIndex: number;
  totalSteps: number;
  onDismiss: () => void;
  onContinue?: () => void;
}

interface Position {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

const TOOLTIP_WIDTH = 360;
const GAP = 16;
const ARROW_SIZE = 8;

export function ConnectedTooltip({
  step,
  currentIndex,
  totalSteps,
  onDismiss,
  onContinue,
}: ConnectedTooltipProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [show, setShow] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const isCentered = step.placement === "center" || !step.targetSelector;
  const showContinue = !!onContinue && step.allowManualAdvance;

  const calculatePosition = useCallback(() => {
    if (isCentered || !step.targetSelector) {
      setPosition(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setPosition(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipHeight = 160;
    let top = 0,
      left = 0;
    let arrowSide: Position["arrowSide"] = "top";

    switch (step.placement) {
      case "bottom":
        top = rect.bottom + GAP + ARROW_SIZE;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        arrowSide = "top";
        break;
      case "top":
        top = rect.top - tooltipHeight - GAP - ARROW_SIZE;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        arrowSide = "bottom";
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + GAP + ARROW_SIZE;
        arrowSide = "left";
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - TOOLTIP_WIDTH - GAP - ARROW_SIZE;
        arrowSide = "right";
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setPosition({ top, left, arrowSide });
  }, [step, isCentered]);

  useEffect(() => {
    calculatePosition();
    const rafId = requestAnimationFrame(calculatePosition);
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (!isCentered && step.targetSelector) {
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        const el = document.querySelector(step.targetSelector!);
        if (el || attempts > 20) {
          if (el) calculatePosition();
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [calculatePosition, isCentered, step.targetSelector]);

  // Entry animation + the "Do this later" grace timer. Kept OUT of the position
  // effect above (which re-runs on every parent re-render — the live map churns
  // during data load) and keyed empty so it fires exactly once per step mount.
  // Previously these timers lived in the position effect, so re-render churn kept
  // restarting the 10s grace and the dismiss control could effectively never appear.
  useEffect(() => {
    const showTimer = setTimeout(() => setShow(true), 50);
    const dismissTimer = setTimeout(() => setShowDismiss(true), 10000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  // Focus management: focus the tooltip card on mount so screen readers
  // announce it and so Esc / Tab work as expected. Restore the previously
  // focused element on unmount (when the step changes or tour ends).
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => {
      cardRef.current?.focus();
    }, 100);
    return () => {
      clearTimeout(focusTimer);
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [step.id]);

  const arrowClasses: Record<string, string> = {
    top: "left-1/2 -translate-x-1/2 -top-2 border-b-surface-container-high border-l-transparent border-r-transparent border-t-transparent",
    bottom:
      "left-1/2 -translate-x-1/2 -bottom-2 border-t-surface-container-high border-l-transparent border-r-transparent border-b-transparent",
    left: "top-1/2 -translate-y-1/2 -left-2 border-r-surface-container-high border-t-transparent border-b-transparent border-l-transparent",
    right:
      "top-1/2 -translate-y-1/2 -right-2 border-l-surface-container-high border-t-transparent border-b-transparent border-r-transparent",
  };

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const springTransform = prefersReducedMotion
    ? "none"
    : show
      ? "scale(1) translateY(0)"
      : "scale(0.95) translateY(8px)";

  const content = (
    <div className="relative">
      <h3 id={titleId} className="text-lg font-medium text-on-surface mb-1.5">
        {step.title}
      </h3>
      <p
        id={bodyId}
        className="text-sm text-on-surface-variant leading-relaxed mb-4"
      >
        {step.body}
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="h-[3px] bg-outline-variant/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-400 ease-out"
              style={{
                width: `${((currentIndex + 1) / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, var(--primary), #00c853)",
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {showDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-200"
            >
              Do this later
            </button>
          )}
          {showContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="text-xs font-medium text-on-primary bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full transition-colors duration-200"
              autoFocus
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Common ARIA + focus props applied to the visible card wrapper.
  const dialogProps = {
    role: "dialog" as const,
    "aria-modal": true,
    "aria-labelledby": titleId,
    "aria-describedby": bodyId,
    tabIndex: -1,
  };

  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          ref={cardRef}
          {...dialogProps}
          className="max-w-sm w-full mx-4 pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-8 outline-none focus:ring-2 focus:ring-primary/40"
          style={{
            transform: springTransform,
            opacity: show ? 1 : 0,
            transition:
              "transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  if (!position) return null;

  return (
    <div
      ref={cardRef}
      {...dialogProps}
      className="fixed z-[9999] pointer-events-auto bg-surface-container-high rounded-2xl shadow-lg p-5 outline-none focus:ring-2 focus:ring-primary/40"
      style={{
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        transform: springTransform,
        opacity: show ? 1 : 0,
        transition:
          "transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out",
      }}
    >
      <div
        aria-hidden="true"
        className={`absolute w-0 h-0 border-[8px] ${arrowClasses[position.arrowSide]}`}
      />
      {content}
    </div>
  );
}
