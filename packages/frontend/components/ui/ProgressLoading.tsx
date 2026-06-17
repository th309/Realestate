/**
 * ProgressLoading
 *
 * Shared step-based progress indicator for long-running AI/generation waits.
 * Extracted from the reports GeneratingState so the same loader can be reused
 * across features (report generation, AI market analysis, etc.).
 *
 * Two variants:
 *  - "fullscreen": centers in the viewport (a whole page is generating, e.g. reports)
 *  - "inline":     fits inside a card/panel (a single section is generating)
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** How long this step stays "active" before advancing, in ms. */
  durationMs: number;
}

interface ProgressLoadingProps {
  steps: ProgressStep[];
  /** Heading shown while in progress. */
  title: string;
  /** Reassuring subtext shown while in progress (set realistic timing here). */
  subtitle: string;
  completeTitle?: string;
  completeSubtitle?: string;
  errorTitle?: string;
  /** Whether the work has completed (freezes steps, shows the check state). */
  isComplete?: boolean;
  /** Error message; when set, renders the error state. */
  error?: string | null;
  /** Called when the user clicks "Try again" in the error state. */
  onRetry?: () => void;
  /** "fullscreen" centers in the viewport; "inline" fits inside a card. */
  variant?: "fullscreen" | "inline";
}

export function ProgressLoading({
  steps,
  title,
  subtitle,
  completeTitle = "Done",
  completeSubtitle = "Ready.",
  errorTitle = "Something went wrong",
  isComplete = false,
  error,
  onRetry,
  variant = "fullscreen",
}: ProgressLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inline = variant === "inline";

  // Animate through steps on a timer, freeze at last step until complete.
  useEffect(() => {
    if (isComplete || error) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const step = steps[currentStep];
    if (!step) return;

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= steps.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return next;
      });
    }, step.durationMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentStep, isComplete, error, steps]);

  // When complete, render every step as done. Derived (not stored) so we never
  // call setState synchronously inside the effect.
  const displayStep = isComplete ? steps.length : currentStep;

  const wrapperClass = inline
    ? "w-full"
    : "min-h-screen flex items-center justify-center";
  const innerClass = inline
    ? "w-full text-center"
    : "w-full max-w-lg mx-auto text-center";

  // Error state
  if (error) {
    return (
      <div className={wrapperClass}>
        <div className={innerClass}>
          <div
            className={`${inline ? "w-12 h-12 mb-3" : "w-16 h-16 mb-4"} rounded-full bg-red-100 flex items-center justify-center mx-auto`}
          >
            <AlertCircle
              className={
                inline ? "w-6 h-6 text-red-600" : "w-8 h-8 text-red-600"
              }
            />
          </div>
          <h2
            className={`${inline ? "text-base" : "text-xl"} font-medium text-on-surface mb-2`}
          >
            {errorTitle}
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-6 py-2.5 rounded-full
                bg-primary text-on-primary text-sm font-medium
                hover:bg-primary/90
                transition-colors duration-200"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        {/* Animated loader */}
        <div className={`relative ${inline ? "mb-5" : "mb-8"}`}>
          <div
            className={`${inline ? "w-16 h-16" : "w-24 h-24"} mx-auto rounded-full bg-primary/10 flex items-center justify-center`}
          >
            <div
              className={`${inline ? "w-11 h-11" : "w-16 h-16"} rounded-full bg-surface flex items-center justify-center shadow-inner`}
            >
              {isComplete ? (
                <CheckCircle2
                  className={`${inline ? "w-6 h-6" : "w-8 h-8"} text-green-600`}
                />
              ) : (
                <Loader2
                  className={`${inline ? "w-6 h-6" : "w-8 h-8"} text-primary animate-spin`}
                />
              )}
            </div>
          </div>
          {!isComplete && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full shadow-sm border border-outline-variant">
              <span className="text-xs font-medium text-on-surface-variant">
                Step {Math.min(displayStep + 1, steps.length)} of {steps.length}
              </span>
            </div>
          )}
        </div>

        <h2
          className={`${inline ? "text-base" : "text-xl"} font-medium text-on-surface mb-1`}
        >
          {isComplete ? completeTitle : title}
        </h2>
        <p
          className={`text-sm text-on-surface-variant ${inline ? "mb-5" : "mb-8"}`}
        >
          {isComplete ? completeSubtitle : subtitle}
        </p>

        {/* Step list */}
        <div className="bg-surface-container-low rounded-xl p-4 shadow-sm text-left">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === displayStep && !isComplete;
            const isDone = index < displayStep || isComplete;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-400
                  ${isActive ? "bg-primary/5" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                    transition-colors duration-400
                    ${
                      isDone
                        ? "bg-green-500 text-white"
                        : isActive
                          ? "bg-primary text-on-primary"
                          : "bg-on-surface/8 text-on-surface-variant"
                    }`}
                >
                  {isDone ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isActive || isDone
                        ? "text-on-surface"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-on-surface-variant truncate">
                      {step.description}
                    </p>
                  )}
                </div>
                {isActive && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
