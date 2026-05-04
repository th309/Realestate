"use client";

import { useEffect, useState } from "react";
import { BreathingSpotlight } from "@/app/onboarding/BreathingSpotlight";
import { ConnectedTooltip } from "@/app/onboarding/ConnectedTooltip";
import type { OnboardingStep } from "@/app/onboarding/onboarding-steps";
import { useTourFromUrl } from "../hooks/useTourFromUrl";
import {
  getStepContent,
  SANDBOX_STEP_ORDER,
  type SandboxStepId,
} from "../step-content";
import { TourBottomSheet } from "./TourBottomSheet";

interface Props {
  stepId: SandboxStepId;
}

const MOBILE_QUERY = "(max-width: 768px)";

export function TourSpotlight({ stepId }: Props) {
  const { active, advance, dismiss, advanceToStep4 } = useTourFromUrl();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (!active || active.stepId !== stepId) return null;

  const content = getStepContent(stepId, active.persona);
  const currentIndex = SANDBOX_STEP_ORDER.indexOf(stepId);
  const totalSteps = SANDBOX_STEP_ORDER.length;
  const isLast = stepId === SANDBOX_STEP_ORDER[SANDBOX_STEP_ORDER.length - 1];
  const onContinue = isLast ? advanceToStep4 : advance;

  if (isMobile) {
    // +1 to denominator so the last sandbox step doesn't render a full bar —
    // step4 (post-tour) completes it.
    const progress = (currentIndex + 1) / (totalSteps + 1);
    return (
      <TourBottomSheet
        title={content.title}
        body={content.body}
        progress={progress}
        onContinue={onContinue}
        onDismiss={dismiss}
        targetSelector={content.targetSelector}
      />
    );
  }

  const stepForTooltip: OnboardingStep = {
    id: content.id,
    route: null,
    targetSelector: content.targetSelector,
    title: content.title,
    body: content.body,
    placement: content.placement,
    allowManualAdvance: true,
  };

  return (
    <>
      <BreathingSpotlight
        targetSelector={content.targetSelector}
        visible
        onClick={onContinue}
      />
      <ConnectedTooltip
        step={stepForTooltip}
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        onDismiss={dismiss}
        onContinue={onContinue}
      />
    </>
  );
}
