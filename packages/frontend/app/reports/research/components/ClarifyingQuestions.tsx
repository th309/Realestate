/**
 * ClarifyingQuestions
 *
 * Second step of the research brief flow. Renders AI-generated scoping
 * questions as M3 Filter Chip groups. Each question supports multiple choice
 * with an "Other" freetext option. Max 3 questions.
 */

"use client";

import React, { useState, useCallback } from "react";
import { ArrowRight, ArrowLeft, HelpCircle } from "lucide-react";
import type { ClarifyingQuestion } from "@/lib/data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClarifyingQuestionsProps {
  topic: string;
  questions: ClarifyingQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onBack: () => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClarifyingQuestions({
  topic,
  questions,
  onSubmit,
  onBack,
  loading = false,
}: ClarifyingQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});

  const displayQuestions = questions.slice(0, 3);

  const handleOptionSelect = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      // Clear "other" text if a non-other option is selected
      if (value !== "__other__") {
        setOtherTexts((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      }
    },
    [],
  );

  const handleOtherTextChange = useCallback(
    (questionId: string, text: string) => {
      setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
      setAnswers((prev) => ({ ...prev, [questionId]: "__other__" }));
    },
    [],
  );

  const handleSubmit = () => {
    if (loading) return;

    // Build final answers, replacing __other__ with actual text
    const finalAnswers: Record<string, string> = {};
    for (const question of displayQuestions) {
      const rawAnswer = answers[question.id];
      if (rawAnswer === "__other__") {
        finalAnswers[question.id] = otherTexts[question.id] || "Other";
      } else if (rawAnswer) {
        finalAnswers[question.id] = rawAnswer;
      }
    }

    onSubmit(finalAnswers);
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= displayQuestions.length;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-medium text-on-surface tracking-tight">
          A few quick questions
        </h2>
        <p className="text-sm text-on-surface-variant mt-1.5 max-w-md mx-auto">
          Help us scope your research on:{" "}
          <span className="font-medium text-on-surface">
            &ldquo;{topic}&rdquo;
          </span>
        </p>
      </div>

      {/* Question cards */}
      <div className="space-y-4 mb-8">
        {displayQuestions.map((question, index) => {
          const selectedValue = answers[question.id];
          const isOtherSelected = selectedValue === "__other__";

          return (
            <div
              key={question.id}
              className="bg-surface-container-low rounded-xl p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-on-surface mb-3">
                <span className="text-on-surface-variant mr-1.5">
                  {index + 1}.
                </span>
                {question.question}
              </p>

              {/* Option chips */}
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const isSelected = selectedValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        handleOptionSelect(question.id, option.value)
                      }
                      className={`inline-flex items-center px-4 py-2 rounded-lg
                        border text-sm transition-colors duration-200
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${
                          isSelected
                            ? "bg-primary text-on-primary border-primary"
                            : "bg-surface text-on-surface border-outline hover:bg-primary/8 hover:border-primary"
                        }`}
                    >
                      {option.label}
                    </button>
                  );
                })}

                {/* "Other" chip */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOptionSelect(question.id, "__other__")}
                  className={`inline-flex items-center px-4 py-2 rounded-lg
                    border text-sm transition-colors duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      isOtherSelected
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface text-on-surface border-outline hover:bg-primary/8 hover:border-primary"
                    }`}
                >
                  Other
                </button>
              </div>

              {/* Freetext for "Other" */}
              {isOtherSelected && (
                <input
                  type="text"
                  value={otherTexts[question.id] || ""}
                  onChange={(event) =>
                    handleOtherTextChange(question.id, event.target.value)
                  }
                  placeholder="Type your answer..."
                  disabled={loading}
                  className="mt-3 w-full h-10 px-4 rounded-lg
                    bg-surface text-on-surface
                    border border-outline
                    placeholder:text-on-surface-variant/60
                    focus:ring-2 focus:ring-primary focus:border-primary
                    disabled:opacity-50
                    text-sm"
                  autoFocus
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full
            text-sm font-medium text-on-surface-variant
            hover:bg-on-surface/8
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !allAnswered}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
            bg-primary text-on-primary text-sm font-medium
            hover:bg-primary/90
            disabled:bg-on-surface/12 disabled:text-on-surface/38
            disabled:cursor-not-allowed
            transition-colors duration-200"
        >
          Generate Research Brief
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
