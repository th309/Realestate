"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTourState } from "./useTourState";
import { TOUR_STEPS, DEFAULT_DEMO_MARKET } from "./tour-steps";
import type { TourStep } from "./tour-steps";
import { TourOverlay } from "./TourOverlay";
import { TourTooltip } from "./TourTooltip";
import { WelcomeWizard } from "./WelcomeWizard";
import type { WizardPreferences } from "./WelcomeWizard";

type TourPhase = "idle" | "wizard" | "tour";

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  restartTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: null,
  restartTour: () => {},
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const {
    shouldShowTour,
    isLoading,
    markComplete,
    savePreferences,
    resetTour,
    onboardingState,
  } = useTourState();
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);

  // Auto-trigger tour for first-time users
  useEffect(() => {
    if (
      !authLoading &&
      !isLoading &&
      user &&
      shouldShowTour &&
      phase === "idle"
    ) {
      setPhase("wizard");
    }
  }, [authLoading, isLoading, user, shouldShowTour, phase]);

  const resolveStepRoute = useCallback(
    (step: TourStep): string | null => {
      if (step.id === "ai-assessment") {
        const preferredMarket = onboardingState?.preferred_markets?.[0];
        if (preferredMarket) {
          return `/market/${preferredMarket.geoId}`;
        }
        return `/market/${DEFAULT_DEMO_MARKET.geoId}`;
      }
      return step.route;
    },
    [onboardingState],
  );

  const navigateToStep = useCallback(
    async (index: number) => {
      const step = TOUR_STEPS[index];
      const route = resolveStepRoute(step);

      if (route && pathname !== route) {
        setNavigating(true);
        router.push(route);
        // Wait for navigation to complete and DOM to settle
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setNavigating(false);
      }

      setStepIndex(index);
    },
    [pathname, router, resolveStepRoute],
  );

  const handleWizardComplete = useCallback(
    (preferences: WizardPreferences) => {
      savePreferences(preferences);
      markComplete();
      setPhase("tour");
      setStepIndex(0);
      navigateToStep(0);
    },
    [savePreferences, markComplete, navigateToStep],
  );

  const handleWizardSkip = useCallback(() => {
    markComplete();
    setPhase("idle");
  }, [markComplete]);

  const handleNext = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      navigateToStep(stepIndex + 1);
    } else {
      setPhase("idle");
    }
  }, [stepIndex, navigateToStep]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      navigateToStep(stepIndex - 1);
    }
  }, [stepIndex, navigateToStep]);

  const handleSkip = useCallback(() => {
    setPhase("idle");
  }, []);

  const restartTourHandler = useCallback(() => {
    resetTour();
    setStepIndex(0);
    setPhase("wizard");
  }, [resetTour]);

  const currentStep = phase === "tour" ? TOUR_STEPS[stepIndex] : null;

  return (
    <TourContext.Provider
      value={{
        isActive: phase !== "idle",
        currentStep,
        restartTour: restartTourHandler,
      }}
    >
      {children}

      {/* Welcome Wizard */}
      {phase === "wizard" && (
        <WelcomeWizard
          onComplete={handleWizardComplete}
          onSkip={handleWizardSkip}
        />
      )}

      {/* Guided Tour */}
      {phase === "tour" && currentStep && !navigating && (
        <>
          <TourOverlay
            targetSelector={currentStep.targetSelector}
            visible
            onClick={handleSkip}
          />
          <TourTooltip
            step={currentStep}
            currentIndex={stepIndex}
            totalSteps={TOUR_STEPS.length}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
