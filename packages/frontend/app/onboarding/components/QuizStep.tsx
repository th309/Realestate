"use client";

/**
 * QuizStep
 *
 * Renders a single quiz step: question heading, subtitle, and option chips
 * styled as M3 Filter Chips (rounded-lg, border-outline).
 *
 * Supports single-select, multi-select, and free-text tag input modes.
 */

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { QuizAnswers } from "../hooks/useQuiz";

// ---------------------------------------------------------------------------
// Step configuration
// ---------------------------------------------------------------------------

export interface QuizStepConfig {
  question: string;
  subtitle: string;
  field: keyof QuizAnswers;
  mode: "single" | "multi" | "tags";
  options?: { value: string; label: string }[];
  /** Max selections for multi-select mode. */
  maxSelections?: number;
}

export const QUIZ_STEPS: QuizStepConfig[] = [
  {
    question: "What brings you here?",
    subtitle: "We'll tailor your experience to your goal.",
    field: "goal",
    mode: "single",
    options: [
      { value: "first_time_buyer", label: "First-time homebuyer" },
      { value: "relocating", label: "Relocating to a new area" },
      { value: "investor_rental", label: "Rental property investor" },
      { value: "investor_flip", label: "Fix & flip investor" },
      { value: "exploring", label: "Just exploring" },
    ],
  },
  {
    question: "What matters most to you?",
    subtitle: "Pick up to 5 priorities. We'll weight your Market Match score.",
    field: "priorities",
    mode: "multi",
    maxSelections: 5,
    options: [
      { value: "affordability", label: "Affordability" },
      { value: "growth", label: "Price growth" },
      { value: "stability", label: "Market stability" },
      { value: "cashflow", label: "Cash flow" },
      { value: "job_market", label: "Job market" },
      { value: "quality_of_life", label: "Quality of life" },
      { value: "climate", label: "Climate" },
      { value: "schools", label: "Schools" },
    ],
  },
  {
    question: "What's your budget range?",
    subtitle: "This helps us filter markets to your price range.",
    field: "budget",
    mode: "single",
    options: [
      { value: "under_200k", label: "Under $200K" },
      { value: "200_400k", label: "$200K - $400K" },
      { value: "400_600k", label: "$400K - $600K" },
      { value: "600k_1m", label: "$600K - $1M" },
      { value: "over_1m", label: "Over $1M" },
    ],
  },
  {
    question: "When are you looking to act?",
    subtitle: "No pressure — this just helps us prioritize insights.",
    field: "timeline",
    mode: "single",
    options: [
      { value: "under_6_months", label: "Within 6 months" },
      { value: "6_to_12_months", label: "6 to 12 months" },
      { value: "1_to_2_years", label: "1 to 2 years" },
      { value: "researching", label: "Just researching" },
    ],
  },
  {
    question: "Any location preferences?",
    subtitle: "Type city or state names, or skip this step.",
    field: "locationTags",
    mode: "tags",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuizStepProps {
  config: QuizStepConfig;
  /** Current value for this step's field. */
  value: string | string[] | null;
  /** Called when the user selects or changes a value. */
  onChange: (value: string | string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuizStep({ config, value, onChange }: QuizStepProps) {
  const { question, subtitle, mode, options, maxSelections } = config;

  return (
    <div className="space-y-6">
      {/* Question heading */}
      <div className="text-center">
        <h2 className="text-2xl font-medium text-on-surface">{question}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
      </div>

      {/* Options / Input */}
      {mode === "single" && options && (
        <SingleSelect
          options={options}
          selected={value as string | null}
          onSelect={(v) => onChange(v)}
        />
      )}

      {mode === "multi" && options && (
        <MultiSelect
          options={options}
          selected={(value as string[]) ?? []}
          maxSelections={maxSelections ?? 5}
          onToggle={(updated) => onChange(updated)}
        />
      )}

      {mode === "tags" && (
        <TagInput
          tags={(value as string[]) ?? []}
          onUpdate={(updated) => onChange(updated)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-select chips
// ---------------------------------------------------------------------------

function SingleSelect({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors duration-200 ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant bg-surface text-on-surface hover:border-outline hover:bg-surface-container-low"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-select chips
// ---------------------------------------------------------------------------

function MultiSelect({
  options,
  selected,
  maxSelections,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  maxSelections: number;
  onToggle: (updated: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onToggle(selected.filter((v) => v !== value));
    } else if (selected.length < maxSelections) {
      onToggle([...selected, value]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          const isDisabled = !isSelected && selected.length >= maxSelections;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              disabled={isDisabled}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors duration-200 ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : isDisabled
                    ? "border-outline-variant/50 bg-surface text-on-surface-variant/40 cursor-not-allowed"
                    : "border-outline-variant bg-surface text-on-surface hover:border-outline hover:bg-surface-container-low"
              }`}
            >
              {isSelected && (
                <span className="mr-1.5 inline-block text-xs">&#10003;</span>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-on-surface-variant">
        {selected.length} / {maxSelections} selected
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag (free-text) input
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onUpdate,
}: {
  tags: string[];
  onUpdate: (updated: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      onUpdate([...tags, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (tag: string) => {
    onUpdate(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Austin, TX"
          className="flex-1 px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!inputValue.trim()}
          className="px-4 py-2.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-primary bg-primary/10 text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-primary/60 hover:text-primary transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-on-surface-variant">
        {tags.length > 0
          ? `${tags.length} location${tags.length !== 1 ? "s" : ""} added`
          : "Press Enter or click Add to tag locations"}
      </p>
    </div>
  );
}
