"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, Target, GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const INVESTMENT_GOALS = [
  { value: "buy_home", label: "Buy a home to live in" },
  { value: "rental_income", label: "Rental income" },
  { value: "fix_flip", label: "Fix & flip" },
  { value: "appreciation", label: "Long-term appreciation" },
  { value: "exploring", label: "Just exploring" },
];

const EXPERIENCE_LEVELS = [
  {
    value: "new",
    label: "New to real estate",
    description: "Learning the basics",
  },
  {
    value: "intermediate",
    label: "Some experience",
    description: "Done a few deals or researched markets",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Active investor, agent, or analyst",
  },
];

interface PreferencesSectionProps {
  user: User;
}

export function PreferencesSection({ user }: PreferencesSectionProps) {
  const [investmentGoal, setInvestmentGoal] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("user_profiles")
      .select("investment_goal, experience_level")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setInvestmentGoal(data.investment_goal);
          setExperienceLevel(data.experience_level);
        }
        setLoading(false);
      });
  }, [user.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase
      .from("user_profiles")
      .update({
        investment_goal: investmentGoal,
        experience_level: experienceLevel,
      })
      .eq("id", user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [user.id, investmentGoal, experienceLevel]);

  if (loading) {
    return (
      <section>
        <h3 className="text-sm font-semibold text-on-surface mb-4">
          Preferences
        </h3>
        <div className="space-y-3">
          <div className="h-10 w-full bg-surface-container-highest rounded-lg animate-pulse" />
          <div className="h-10 w-full bg-surface-container-highest rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-1">
        Preferences
      </h3>
      <p className="text-xs text-on-surface-variant mb-4">
        These settings personalize your reports and market analysis.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}
        </div>
      )}

      {/* Investment Goal */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant mb-2">
          <Target className="w-3.5 h-3.5" />
          Investment Goal
        </label>
        <div className="flex flex-wrap gap-2">
          {INVESTMENT_GOALS.map((goal) => {
            const isSelected = investmentGoal === goal.value;
            return (
              <button
                key={goal.value}
                type="button"
                onClick={() => setInvestmentGoal(goal.value)}
                className={`px-3.5 py-2 rounded-lg border text-sm transition-colors
                  ${
                    isSelected
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-container-low text-on-surface border-outline-variant hover:border-primary hover:bg-primary/5"
                  }`}
              >
                {goal.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Experience Level */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant mb-2">
          <GraduationCap className="w-3.5 h-3.5" />
          Experience Level
        </label>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = experienceLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setExperienceLevel(level.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
                  ${
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-surface-container-low border-outline-variant hover:border-primary hover:bg-primary/5"
                  }`}
              >
                <span
                  className={`text-sm font-medium ${isSelected ? "text-primary" : "text-on-surface"}`}
                >
                  {level.label}
                </span>
                <span className="block text-xs text-on-surface-variant mt-0.5">
                  {level.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? (
          "Saving..."
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            Saved!
          </>
        ) : (
          "Save Preferences"
        )}
      </button>
    </section>
  );
}
