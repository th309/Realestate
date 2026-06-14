"use client";

/**
 * USE QUIZ HOOK
 *
 * Manages multi-step onboarding quiz state: current step, accumulated
 * answers, navigation (next/back), and final submission via the
 * preferences data layer.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  type UserGoal,
  type Timeline,
  type UpsertPreferencesPayload,
} from "@/lib/data";
import { usePreferences } from "@/lib/data/hooks/usePreferences";
import { trackEvent } from "@/lib/analytics/tracker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetRange =
  | "under_200k"
  | "200_400k"
  | "400_600k"
  | "600k_1m"
  | "over_1m";

/** Map quiz budget ranges to numeric min/max for the API. */
const BUDGET_TO_NUMBERS: Record<BudgetRange, { min: number; max: number }> = {
  under_200k: { min: 0, max: 200_000 },
  "200_400k": { min: 200_000, max: 400_000 },
  "400_600k": { min: 400_000, max: 600_000 },
  "600k_1m": { min: 600_000, max: 1_000_000 },
  over_1m: { min: 1_000_000, max: 10_000_000 },
};

export interface QuizAnswers {
  goal: UserGoal | null;
  priorities: string[];
  budget: BudgetRange | null;
  timeline: Timeline | null;
  locationTags: string[];
}

export interface UseQuizResult {
  /** Current step index (0-4). */
  step: number;
  /** Accumulated quiz answers. */
  answers: QuizAnswers;
  /** Total number of steps. */
  totalSteps: number;
  /** Whether the quiz is currently being submitted. */
  isSubmitting: boolean;
  /** Submission error, if any. */
  submitError: Error | null;
  /** Advance to the next step. */
  next: () => void;
  /** Go back one step. */
  back: () => void;
  /** Update answers for a given field. */
  setAnswer: <K extends keyof QuizAnswers>(
    key: K,
    value: QuizAnswers[K],
  ) => void;
  /** Submit all accumulated answers to the backend. */
  submit: () => Promise<void>;
  /** Skip the quiz entirely (fires tracking event). */
  skip: () => void;
  /** Whether the current step has a valid selection. */
  canAdvance: boolean;
}

const TOTAL_STEPS = 5;

const INITIAL_ANSWERS: QuizAnswers = {
  goal: null,
  priorities: [],
  budget: null,
  timeline: null,
  locationTags: [],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuiz(onComplete: (answers: QuizAnswers) => void): UseQuizResult {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(INITIAL_ANSWERS);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const quizStarted = useRef(false);

  const { savePreferences, isSaving } = usePreferences();

  // Track quiz start on mount
  useEffect(() => {
    if (!quizStarted.current) {
      quizStarted.current = true;
      trackEvent("onboarding.quiz_start", { total_steps: TOTAL_STEPS });
    }
  }, []);

  const setAnswer = useCallback(
    <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => {
      setAnswers((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canAdvance = (() => {
    switch (step) {
      case 0:
        return answers.goal !== null;
      case 1:
        return answers.priorities.length > 0;
      case 2:
        return answers.budget !== null;
      case 3:
        return answers.timeline !== null;
      case 4:
        return true; // Location is optional
      default:
        return false;
    }
  })();

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      trackEvent("onboarding.quiz_step_complete", { step: step + 1, total_steps: TOTAL_STEPS });
      setStep((s) => s + 1);
    }
  }, [step]);

  const back = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const skip = useCallback(() => {
    trackEvent("onboarding.quiz_skip", { at_step: step + 1, total_steps: TOTAL_STEPS });
    onComplete(answers);
  }, [step, answers, onComplete]);

  const submit = useCallback(async () => {
    setSubmitError(null);

    const budgetNumbers = answers.budget
      ? BUDGET_TO_NUMBERS[answers.budget]
      : undefined;

    const payload: UpsertPreferencesPayload = {
      goal: answers.goal ?? undefined,
      priorities:
        answers.priorities.length > 0 ? answers.priorities : undefined,
      budget_min: budgetNumbers?.min,
      budget_max: budgetNumbers?.max,
      timeline: answers.timeline ?? undefined,
      location_preferences:
        answers.locationTags.length > 0 ? answers.locationTags : undefined,
    };

    try {
      await savePreferences(payload);
      trackEvent("onboarding.quiz_complete", {
        goal: answers.goal,
        budget: answers.budget,
        timeline: answers.timeline,
        priority_count: answers.priorities.length,
        has_locations: answers.locationTags.length > 0,
      });
      onComplete(answers);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [answers, savePreferences, onComplete]);

  return {
    step,
    answers,
    totalSteps: TOTAL_STEPS,
    isSubmitting: isSaving,
    submitError,
    next,
    back,
    setAnswer,
    submit,
    skip,
    canAdvance,
  };
}
