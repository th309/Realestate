"use client";

/**
 * Onboarding Quiz Page
 *
 * Full-page 5-step quiz that collects user preferences (goal, priorities,
 * budget, timeline, locations) and saves them via PUT /api/preferences.
 * After completion, redirects the user to the map dashboard.
 *
 * M3 design: centered card layout, smooth step transitions.
 */

import { useRouter } from "next/navigation";
import { Building2, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useQuiz } from "./hooks/useQuiz";
import { QuizStep, QUIZ_STEPS } from "./components/QuizStep";
import { QuizProgress } from "./components/QuizProgress";
import type { QuizAnswers } from "./hooks/useQuiz";

/**
 * Maps the user's quiz goal to the best landing page after onboarding.
 *
 * Goal values: first_time_buyer | relocating | investor_rental | investor_flip | exploring | null
 *
 * The map page accepts ?view=investor or ?view=homebuyer to pre-select the
 * correct dashboard layout. Other routes like /scores or /graphs are also valid
 * destinations for specific intent signals.
 */
function getRedirectUrl(answers: QuizAnswers): string {
  switch (answers.goal) {
    case "investor_rental":
    case "investor_flip":
      return "/map?view=investor";
    case "first_time_buyer":
    case "relocating":
      return "/map?view=homebuyer";
    case "exploring":
    default:
      return "/map";
  }
}

export default function OnboardingQuizPage() {
  const router = useRouter();

  const {
    step,
    answers,
    totalSteps,
    isSubmitting,
    submitError,
    next,
    back,
    setAnswer,
    submit,
    skip,
    canAdvance,
  } = useQuiz((completedAnswers) => {
    router.push(getRedirectUrl(completedAnswers));
  });

  const currentConfig = QUIZ_STEPS[step];
  const isLastStep = step === totalSteps - 1;

  // Resolve the current value for the active step's field
  const currentValue = answers[currentConfig.field];

  const handleChange = (value: string | string[]) => {
    const field = currentConfig.field as keyof QuizAnswers;
    // Type assertion is safe: single-select fields get string, multi/tags get string[]
    setAnswer(field, value as QuizAnswers[typeof field]);
  };

  const handleContinue = () => {
    if (isLastStep) {
      submit();
    } else {
      next();
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Card container */}
        <div className="bg-surface-container-low rounded-3xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="pt-8 pb-2 px-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold text-on-surface">
                PropertyIQ Setup
              </h1>
              <p className="mt-1 text-xs text-on-surface-variant">
                Step {step + 1} of {totalSteps}
              </p>
            </div>

            {/* Progress dots */}
            <QuizProgress currentStep={step} totalSteps={totalSteps} />
          </div>

          {/* Step content with transition */}
          <div className="px-8 py-6">
            <div
              key={step}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
            >
              <QuizStep
                config={currentConfig}
                value={currentValue}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Error banner */}
          {submitError && (
            <div className="mx-8 mb-4 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
              <span>Failed to save. Please try again.</span>
            </div>
          )}

          {/* Navigation */}
          <div className="px-8 pb-8 flex items-center justify-between">
            {/* Back / Skip */}
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-full transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={skip}
                className="px-4 py-2 text-xs text-on-surface-variant/60 hover:text-on-surface-variant rounded-full transition-colors duration-200"
              >
                Skip for now
              </button>
            )}

            {/* Continue / Finish */}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canAdvance || isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  Finish
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skip footer text */}
        <p className="mt-4 text-center text-xs text-on-surface-variant">
          You can update these preferences anytime in Settings.
        </p>
      </div>
    </div>
  );
}
