"use client";

/**
 * ProfileSummary
 *
 * Displays the user's quiz preferences: goal, priorities, budget,
 * location preferences, and timeline. Links to /onboarding to edit.
 */

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { UserPreferences } from "@/lib/data";

// ---------------------------------------------------------------------------
// Label maps (mirrors QuizStep option labels)
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<string, string> = {
  first_time_buyer: "First-time homebuyer",
  relocating: "Relocating to a new area",
  investor_rental: "Rental property investor",
  investor_flip: "Fix & flip investor",
  exploring: "Just exploring",
};

const PRIORITY_LABELS: Record<string, string> = {
  affordability: "Affordability",
  growth: "Price growth",
  stability: "Market stability",
  cashflow: "Cash flow",
  job_market: "Job market",
  quality_of_life: "Quality of life",
  climate: "Climate",
  schools: "Schools",
};

const TIMELINE_LABELS: Record<string, string> = {
  under_6_months: "Within 6 months",
  "6_to_12_months": "6 to 12 months",
  "1_to_2_years": "1 to 2 years",
  researching: "Just researching",
};

function formatBudget(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Not set";
  const fmt = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : `$${Math.round(v / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)} - ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProfileSummaryProps {
  preferences: UserPreferences;
}

export function ProfileSummary({ preferences }: ProfileSummaryProps) {
  const goalLabel = preferences.goal
    ? (GOAL_LABELS[preferences.goal] ?? preferences.goal)
    : "Not set";

  const priorityLabels = (preferences.priorities ?? []).map(
    (p) => PRIORITY_LABELS[p] ?? p,
  );

  const timelineLabel = preferences.timeline
    ? (TIMELINE_LABELS[preferences.timeline] ?? preferences.timeline)
    : "Not set";

  const budgetLabel = formatBudget(
    preferences.budget_min,
    preferences.budget_max,
  );

  const locations = preferences.location_preferences ?? [];

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-on-surface">Your Profile</h2>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Goal */}
        <SummaryField label="Goal" value={goalLabel} />

        {/* Priorities */}
        <SummaryField
          label="Priorities"
          value={
            priorityLabels.length > 0 ? priorityLabels.join(", ") : "Not set"
          }
        />

        {/* Budget */}
        <SummaryField label="Budget" value={budgetLabel} />

        {/* Timeline */}
        <SummaryField label="Timeline" value={timelineLabel} />

        {/* Locations */}
        <SummaryField
          label="Locations"
          value={locations.length > 0 ? locations.join(", ") : "Anywhere"}
        />
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-sm text-on-surface truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
