// packages/frontend/app/analyzer/components/StrategyCompare/GoalPicker.tsx
"use client";

/**
 * Goal selector row for "Help me decide" (compare) mode. 4 chips:
 * Cash flow / Long-term wealth / Fast cash / Recycle capital.
 *
 * Owned by AnalyzerClient (selectedGoal state lives there + persists to
 * localStorage). This component is presentation-only — receives the
 * current selection + onChange callback.
 */

import {
  ALL_GOALS,
  GOAL_DESCRIPTION,
  GOAL_LABEL,
  type InvestorGoal,
} from "../../lib/goal-types";

interface GoalPickerProps {
  selectedGoal: InvestorGoal | null;
  onChange: (goal: InvestorGoal) => void;
}

export function GoalPicker({ selectedGoal, onChange }: GoalPickerProps) {
  return (
    <div
      data-goal-picker
      role="radiogroup"
      aria-label="What's your investment goal for this deal?"
      className="flex flex-col gap-2"
    >
      <div className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
        Your goal for this deal
      </div>
      <div className="inline-flex flex-wrap gap-2">
        {ALL_GOALS.map((goal) => {
          const isActive = goal === selectedGoal;
          return (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={GOAL_LABEL[goal]}
              data-goal={goal}
              title={GOAL_DESCRIPTION[goal]}
              onClick={() => onChange(goal)}
              className={
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors border " +
                (isActive
                  ? "bg-[var(--md-primary)] text-[var(--md-on-primary)] border-[var(--md-primary)]"
                  : "bg-transparent text-on-surface-variant border-outline-variant hover:text-on-surface hover:border-outline")
              }
            >
              {GOAL_LABEL[goal]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
