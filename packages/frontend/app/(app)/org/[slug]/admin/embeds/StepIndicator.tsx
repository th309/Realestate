"use client";

import React from "react";

interface Step {
  label: string;
  number: number;
}

const STEPS: Step[] = [
  { number: 1, label: "Choose Widget" },
  { number: 2, label: "Configure" },
  { number: 3, label: "Get Your Code" },
];

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  maxReachedStep: 1 | 2 | 3;
}

export function StepIndicator({
  currentStep,
  onStepClick,
  maxReachedStep,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const isClickable = step.number <= maxReachedStep;

        return (
          <React.Fragment key={step.number}>
            {i > 0 && (
              <div
                className={`hidden sm:block h-px w-12 ${
                  step.number <= currentStep
                    ? "bg-primary"
                    : "bg-outline-variant"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() =>
                isClickable && onStepClick(step.number as 1 | 2 | 3)
              }
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 transition-colors duration-200 ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {isCompleted ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-primary/70"
                      : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
