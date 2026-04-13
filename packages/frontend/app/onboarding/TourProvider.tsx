"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTourState } from "./useTourState";
import { ONBOARDING_STEPS } from "./onboarding-steps";
import type { OnboardingStep } from "./onboarding-steps";
import { BreathingSpotlight } from "./BreathingSpotlight";
import { ConnectedTooltip } from "./ConnectedTooltip";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { triggerConfetti } from "./celebrations";

type TourPhase = "idle" | "guided";

interface TourContextValue {
  isActive: boolean;
  currentStep: OnboardingStep | null;
  restartTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: null,
  restartTour: () => {},
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { onboardingState, markComplete, resetTour } = useTourState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(1); // Start at 1 — step 0 is /get-started
  const [navigating, setNavigating] = useState(false);
  const actionListenerRef = useRef<(() => void) | null>(null);

  // Detect ?onboarding=true (set by /get-started after market selection)
  useEffect(() => {
    if (searchParams?.get("onboarding") === "true" && phase === "idle") {
      setPhase("guided");
      setStepIndex(1); // Step 1: view-score
    }
  }, [searchParams, phase]);

  // Reset on signout
  useEffect(() => {
    if (!user && phase !== "idle") {
      setPhase("idle");
      setStepIndex(1);
    }
  }, [user, phase]);

  // Set up action listeners for action-gated steps
  useEffect(() => {
    if (actionListenerRef.current) {
      actionListenerRef.current();
      actionListenerRef.current = null;
    }

    if (phase !== "guided") return;
    const step = ONBOARDING_STEPS[stepIndex];
    if (!step?.actionSelector || !step.actionEvent) return;

    const setupListener = () => {
      const el = document.querySelector(step.actionSelector!);
      if (!el) return;

      const handler = () => {
        if (step.id === "generate-report") {
          triggerConfetti();
        }

        if (stepIndex < ONBOARDING_STEPS.length - 1) {
          const nextStep = ONBOARDING_STEPS[stepIndex + 1];
          if (nextStep.route && pathname !== nextStep.route) {
            setNavigating(true);
            router.push(nextStep.route);
            setTimeout(() => {
              setNavigating(false);
              setStepIndex(stepIndex + 1);
            }, 1000);
          } else {
            setStepIndex(stepIndex + 1);
          }
        } else {
          markComplete();
          setPhase("idle");
        }
      };

      el.addEventListener(step.actionEvent!, handler, { once: true });
      actionListenerRef.current = () => {
        el.removeEventListener(step.actionEvent!, handler);
      };
    };

    let attempts = 0;
    const pollId = setInterval(() => {
      attempts++;
      const el = document.querySelector(step.actionSelector!);
      if (el) {
        setupListener();
        clearInterval(pollId);
      }
      if (attempts > 30) clearInterval(pollId);
    }, 200);

    return () => {
      clearInterval(pollId);
      if (actionListenerRef.current) {
        actionListenerRef.current();
        actionListenerRef.current = null;
      }
    };
  }, [phase, stepIndex, pathname, router, markComplete]);

  const handleDismiss = useCallback(() => {
    markComplete();
    setPhase("idle");
  }, [markComplete]);

  const restartTourHandler = useCallback(() => {
    resetTour();
    setStepIndex(0);
    router.push("/get-started");
  }, [resetTour, router]);

  const currentStep = phase === "guided" ? ONBOARDING_STEPS[stepIndex] : null;

  // Resolve persona-specific body text
  const resolvedStep = currentStep
    ? {
        ...currentStep,
        body:
          currentStep.personaBody?.[onboardingState?.user_type ?? ""] ??
          currentStep.body,
      }
    : null;

  return (
    <TourContext.Provider
      value={{
        isActive: phase !== "idle",
        currentStep: resolvedStep,
        restartTour: restartTourHandler,
      }}
    >
      {children}

      <OnboardingProgressBar
        currentStep={stepIndex}
        totalSteps={ONBOARDING_STEPS.length}
        visible={phase === "guided"}
      />

      {phase === "guided" && resolvedStep && !navigating && (
        <>
          <BreathingSpotlight
            targetSelector={resolvedStep.targetSelector}
            visible
            onClick={resolvedStep.actionSelector ? undefined : handleDismiss}
          />
          <ConnectedTooltip
            step={resolvedStep}
            currentIndex={stepIndex}
            totalSteps={ONBOARDING_STEPS.length}
            onDismiss={handleDismiss}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
