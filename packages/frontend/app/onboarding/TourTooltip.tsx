"use client";

import { useEffect, useState, useCallback } from "react";
import type { TourStep } from "./tour-steps";

interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Position {
  top: number;
  left: number;
}

export function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TourTooltipProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const isCentered = step.placement === "center" || !step.targetSelector;

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
    const tooltipWidth = step.highlight ? 512 : 448;
    const tooltipHeight = 200;
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setPosition({ top, left });
  }, [step, isCentered]);

  useEffect(() => {
    calculatePosition();
    const rafId = requestAnimationFrame(calculatePosition);
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    // Poll for target element if not found (handles post-navigation render delays)
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

  const maxWidthClass = step.highlight ? "max-w-lg" : "max-w-md";
  const accentBorder = step.highlight ? "border-l-4 border-primary" : "";

  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className={`${maxWidthClass} w-full mx-4 pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-8 ${accentBorder}`}
        >
          <TooltipContent
            step={step}
            currentIndex={currentIndex}
            totalSteps={totalSteps}
            isFirst={isFirst}
            isLast={isLast}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
          />
        </div>
      </div>
    );
  }

  if (!position) return null;

  return (
    <div
      className={`fixed z-[9999] ${maxWidthClass} w-full pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-6 ${accentBorder}`}
      style={{ top: position.top, left: position.left }}
    >
      <TooltipContent
        step={step}
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        isFirst={isFirst}
        isLast={isLast}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    </div>
  );
}

function TooltipContent({
  step,
  currentIndex,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h3 className="text-xl font-medium text-on-surface mb-2">{step.title}</h3>
      <p className="text-base text-on-surface-variant leading-relaxed mb-6">
        {step.body}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i === currentIndex
                  ? "bg-primary"
                  : i < currentIndex
                    ? "bg-primary/40"
                    : "bg-outline-variant"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isLast && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-full transition-colors duration-200"
            >
              Skip tour
            </button>
          )}
          {!isFirst && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/8 rounded-full transition-colors duration-200"
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
