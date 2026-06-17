// The shape of a single guided-tour step, consumed by ConnectedTooltip and the
// spotlight engine. Extracted from the deleted System B onboarding-steps.ts so
// the tour primitives no longer depend on that module.
export interface OnboardingStep {
  id: string;
  route: string | null;
  targetSelector: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  allowManualAdvance?: boolean;
}
