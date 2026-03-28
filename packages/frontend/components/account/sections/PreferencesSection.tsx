"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, Target, GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchPreferences,
  upsertPreferences,
} from "@/lib/data/fetchers/preferences";
import { HomebuyerDetailsSubsection } from "./HomebuyerDetailsSubsection";
import { InvestorDetailsSubsection } from "./InvestorDetailsSubsection";
import type { User } from "@supabase/supabase-js";

// --- Constants ---------------------------------------------------------------

const INVESTMENT_GOALS = [
  { value: "buy_home", label: "Buy a Home" },
  { value: "rental_income", label: "Rental Income" },
  { value: "fix_flip", label: "Fix & Flip" },
  { value: "appreciation", label: "Long-term Appreciation" },
  { value: "exploring", label: "Just Exploring" },
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

const HOMEBUYER_GOALS = ["buy_home"];
const INVESTOR_GOALS = ["rental_income", "fix_flip", "appreciation"];

// --- Component ---------------------------------------------------------------

interface PreferencesSectionProps {
  user: User;
}

export function PreferencesSection({ user }: PreferencesSectionProps) {
  const [investmentGoal, setInvestmentGoal] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [budgetMin, setBudgetMin] = useState<number | null>(null);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [targetStates, setTargetStates] = useState<string[]>([]);
  const [targetReturn, setTargetReturn] = useState<string>("");
  const [preApproved, setPreApproved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("investment_goal, experience_level")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setInvestmentGoal(profileData.investment_goal);
        setExperienceLevel(profileData.experience_level);
      }

      try {
        const prefs = await fetchPreferences();
        if (prefs) {
          setBudgetMin(prefs.budget_min);
          setBudgetMax(prefs.budget_max);
          setTimeline(prefs.timeline);
          setTargetStates(prefs.location_preferences ?? []);
        }
      } catch {
        // Preferences may not exist yet
      }

      setLoading(false);
    };

    loadAll();
  }, [user.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: profileErr } = await supabase
        .from("user_profiles")
        .update({
          investment_goal: investmentGoal,
          experience_level: experienceLevel,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      await upsertPreferences({
        goal: investmentGoal as any,
        budget_min: budgetMin ?? undefined,
        budget_max: budgetMax ?? undefined,
        timeline: timeline as any,
        location_preferences:
          targetStates.length > 0 ? targetStates : undefined,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save preferences",
      );
    } finally {
      setSaving(false);
    }
  }, [
    user.id,
    investmentGoal,
    experienceLevel,
    budgetMin,
    budgetMax,
    timeline,
    targetStates,
  ]);

  const isHomebuyer =
    investmentGoal != null && HOMEBUYER_GOALS.includes(investmentGoal);
  const isInvestor =
    investmentGoal != null && INVESTOR_GOALS.includes(investmentGoal);

  const toggleState = (state: string) => {
    setTargetStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state],
    );
  };

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-[#3949AB]" />
          <h2 className="text-lg font-semibold text-on-surface">Preferences</h2>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-full bg-surface-container-highest rounded-lg animate-pulse" />
          <div className="h-10 w-full bg-surface-container-highest rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Target className="w-5 h-5 text-[#3949AB]" />
        <h2 className="text-lg font-semibold text-on-surface">Preferences</h2>
      </div>
      <p className="text-xs text-on-surface-variant mb-5">
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
                className={`px-3.5 py-2 rounded-full border text-sm transition-colors ${
                  isSelected
                    ? "bg-[#3949AB] text-white border-[#3949AB]"
                    : "bg-surface-container-low text-on-surface border-outline-variant hover:border-[#3949AB] hover:bg-[#3949AB]/5"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = experienceLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setExperienceLevel(level.value)}
                className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                  isSelected
                    ? "bg-[#3949AB]/10 border-[#3949AB]"
                    : "bg-surface-container-low border-outline-variant hover:border-[#3949AB] hover:bg-[#3949AB]/5"
                }`}
              >
                <span
                  className={`text-sm font-medium ${isSelected ? "text-[#3949AB]" : "text-on-surface"}`}
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

      {/* Conditional sub-sections */}
      {isHomebuyer && (
        <HomebuyerDetailsSubsection
          budgetMin={budgetMin}
          budgetMax={budgetMax}
          timeline={timeline}
          preApproved={preApproved}
          onBudgetMinChange={setBudgetMin}
          onBudgetMaxChange={setBudgetMax}
          onTimelineChange={setTimeline}
          onPreApprovedChange={setPreApproved}
        />
      )}

      {isInvestor && (
        <InvestorDetailsSubsection
          budgetMin={budgetMin}
          budgetMax={budgetMax}
          targetReturn={targetReturn}
          targetStates={targetStates}
          onBudgetMinChange={setBudgetMin}
          onBudgetMaxChange={setBudgetMax}
          onTargetReturnChange={setTargetReturn}
          onToggleState={toggleState}
        />
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? (
          "Saving..."
        ) : saved ? (
          <>
            <Check className="w-4 h-4" /> Saved!
          </>
        ) : (
          "Save Preferences"
        )}
      </button>
    </section>
  );
}
