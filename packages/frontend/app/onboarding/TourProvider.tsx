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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTourState } from "./useTourState";
import { ONBOARDING_STEPS } from "./onboarding-steps";
import type { OnboardingStep } from "./onboarding-steps";
import { BreathingSpotlight } from "./BreathingSpotlight";
import { ConnectedTooltip } from "./ConnectedTooltip";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { triggerConfetti } from "./celebrations";
import { updateChecklistTask, incrementUsageStat } from "@/lib/data";
import { trackEvent } from "@/lib/analytics/tracker";

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
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(1); // Start at 1 — step 0 is /get-started
  const [navigating, setNavigating] = useState(false);
  const actionListenerRef = useRef<(() => void) | null>(null);
  const stepMountedAtRef = useRef<number>(0);

  // Detect ?resetTour=1 — clears onboarding_completed_at and routes to
  // /get-started so the full tour re-runs. Works on any URL the provider
  // is mounted on. `resetTour` is a no-op when not authenticated.
  useEffect(() => {
    if (searchParams?.get("resetTour") !== "1") return;
    resetTour();
    setStepIndex(0);
    router.replace("/tour?resume=fresh");
  }, [searchParams, resetTour, router]);

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

  // Fire spotlight_step_viewed when a step becomes active
  useEffect(() => {
    if (phase !== "guided" || navigating) return;
    const step = ONBOARDING_STEPS[stepIndex];
    if (!step) return;
    stepMountedAtRef.current = Date.now();
    trackEvent("onboarding.spotlight_step_viewed", {
      step_name: step.id,
      step_index: stepIndex,
    });
  }, [phase, stepIndex, navigating]);

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
        trackEvent("onboarding.spotlight_step_completed", {
          step_name: step.id,
          step_index: stepIndex,
          duration_ms: Date.now() - stepMountedAtRef.current,
        });
        // Mark checklist + usage for the completed step
        if (step.id === "view-score") {
          Promise.allSettled([
            updateChecklistTask("view_score"),
            incrementUsageStat("scores_checked"),
          ]).then(() =>
            queryClient.invalidateQueries({ queryKey: ["onboarding-state"] }),
          );
        } else if (step.id === "generate-report") {
          triggerConfetti();
          Promise.allSettled([
            updateChecklistTask("generate_report"),
            incrementUsageStat("reports_generated"),
          ]).then(() =>
            queryClient.invalidateQueries({ queryKey: ["onboarding-state"] }),
          );
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
    const step = ONBOARDING_STEPS[stepIndex];
    trackEvent("onboarding.spotlight_dismissed", {
      at_step: step?.id ?? `index_${stepIndex}`,
      duration_ms: Date.now() - stepMountedAtRef.current,
    });
    markComplete();
    setPhase("idle");
  }, [markComplete, stepIndex]);

  // Advance to the next step manually (used by the "Continue" button on
  // informational steps that have no natural element to click).
  const handleManualAdvance = useCallback(() => {
    const step = ONBOARDING_STEPS[stepIndex];
    if (!step) return;
    trackEvent("onboarding.spotlight_step_completed", {
      step_name: step.id,
      step_index: stepIndex,
      duration_ms: Date.now() - stepMountedAtRef.current,
    });
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      markComplete();
      setPhase("idle");
      return;
    }
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
  }, [stepIndex, pathname, router, markComplete]);

  // Esc closes the tour at any time. WCAG 2.1 keyboard requirement.
  useEffect(() => {
    if (phase !== "guided") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleDismiss]);

  const restartTourHandler = useCallback(() => {
    resetTour();
    setStepIndex(0);
    router.push("/tour?resume=fresh");
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
            onContinue={handleManualAdvance}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
