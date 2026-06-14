"use client";

/**
 * QuizProgress
 *
 * 5-dot progress indicator for the onboarding quiz.
 * Dots fill with the primary color as the user advances through steps.
 */

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function QuizProgress({ currentStep, totalSteps }: QuizProgressProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-400 ${
            i <= currentStep ? "w-8 bg-primary" : "w-2 bg-outline-variant"
          }`}
        />
      ))}
    </div>
  );
}
