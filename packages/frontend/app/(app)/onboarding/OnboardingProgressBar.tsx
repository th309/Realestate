"use client";

interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps: number;
  visible: boolean;
}

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
  visible,
}: OnboardingProgressBarProps) {
  if (!visible) return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] h-[3px]">
      <div
        className="h-full rounded-r-full transition-all duration-600 ease-out"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--primary), #00c853)",
        }}
      />
    </div>
  );
}
