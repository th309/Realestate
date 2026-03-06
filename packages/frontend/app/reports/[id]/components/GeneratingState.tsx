/**
 * GeneratingState
 *
 * Shows a step-based progress indicator while the backend generates
 * a homebuyer or investor report. Matches the ResearchProgress design.
 */

"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Loader2,
  TrendingUp,
  Newspaper,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ReportWithTemplate } from "./types";

// ---------------------------------------------------------------------------
// Progress steps
// ---------------------------------------------------------------------------

export const GENERATION_STEPS = [
  {
    id: "scores",
    label: "Calculating market scores",
    description: "Analyzing market health indicators",
    icon: TrendingUp,
    durationMs: 4000,
  },
  {
    id: "news",
    label: "Gathering market signals",
    description: "Collecting recent market data",
    icon: Newspaper,
    durationMs: 10000,
  },
  {
    id: "ai",
    label: "Generating AI analysis",
    description: "Creating personalized insights",
    icon: Sparkles,
    durationMs: 30000,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GeneratingStateProps {
  report: ReportWithTemplate;
  /** Whether the report generation has completed */
  isComplete?: boolean;
  /** Error message if generation failed */
  error?: string | null;
  /** Called when the user wants to retry after an error */
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratingState({
  report,
  isComplete = false,
  error,
  onRetry,
}: GeneratingStateProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate through steps on a timer, freeze at last step until complete
  useEffect(() => {
    if (isComplete || error) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (isComplete) setCurrentStep(GENERATION_STEPS.length);
      return;
    }

    const step = GENERATION_STEPS[currentStep];
    if (!step) return;

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        const nextStep = prev + 1;
        if (nextStep >= GENERATION_STEPS.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return nextStep;
      });
    }, step.durationMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentStep, isComplete, error]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-medium text-on-surface mb-2">
            Report generation failed
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto text-center">
        {/* Animated loader */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-inner">
              {isComplete ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              )}
            </div>
          </div>
          {!isComplete && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full shadow-sm border border-outline-variant">
              <span className="text-xs font-medium text-on-surface-variant">
                Step {Math.min(currentStep + 1, GENERATION_STEPS.length)} of{" "}
                {GENERATION_STEPS.length}
              </span>
            </div>
          )}
        </div>

        <h2 className="text-xl font-medium text-on-surface mb-1">
          {isComplete ? "Report complete" : "Generating Your Report"}
        </h2>
        <p className="text-sm text-on-surface-variant mb-8">
          {isComplete
            ? "Your report is ready."
            : "This usually takes 10-30 seconds."}
        </p>

        {/* Step list */}
        <div className="bg-surface-container-low rounded-xl p-4 shadow-sm text-left">
          {GENERATION_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep && !isComplete;
            const isDone = index < currentStep || isComplete;

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
                      isActive
                        ? "text-on-surface"
                        : isDone
                          ? "text-on-surface"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {step.description}
                  </p>
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
