"use client";

/**
 * GrowthProgressWidget — Displays growth goal progress with milestone tracking.
 * Fetches independently via its own useQuery so it doesn't couple to OverviewTab data.
 * Always visible: shows empty state when no active goal, error state on failure.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchGrowthProgress } from "@/lib/data/fetchers/admin-analytics";

export function GrowthProgressWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "growth-progress"],
    queryFn: fetchGrowthProgress,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return <GrowthProgressSkeleton />;
  }

  if (isError) {
    return <GrowthProgressError />;
  }

  if (!data?.goal?.isActive) {
    return <GrowthProgressEmpty />;
  }

  const {
    goal,
    currentPaidUsers,
    daysElapsed,
    daysRemaining,
    totalDays,
    currentGrowthRate,
    requiredGrowthRate,
    milestoneProgress,
  } = data;
  const progressPercent = Math.min(
    (currentPaidUsers / goal.targetPaidUsers) * 100,
    100,
  );
  const acceleration =
    requiredGrowthRate > 0
      ? (requiredGrowthRate / Math.max(currentGrowthRate, 0.01)).toFixed(1)
      : "—";
  const onTrack = currentGrowthRate >= requiredGrowthRate;

  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <TargetIcon />
          </div>
          <div>
            <h3 className="text-title-medium font-medium text-on-surface">
              {goal.name}
            </h3>
            <p className="text-label-small text-on-surface-variant">
              Target: {goal.targetPaidUsers} paid users &middot;{" "}
              {new Date(goal.startDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
              {" → "}
              {new Date(goal.targetDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}{" "}
              <span className="text-on-surface-variant/60">
                (day {daysElapsed} of {totalDays})
              </span>
            </p>
          </div>
        </div>
        <DaysRemainingBadge days={daysRemaining} onTrack={onTrack} />
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-label-medium font-medium text-on-surface">
            {currentPaidUsers}{" "}
            <span className="text-on-surface-variant font-normal">
              / {goal.targetPaidUsers}
            </span>
          </span>
          <span className="text-label-small text-on-surface-variant">
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-surface-container-high overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      {milestoneProgress.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {milestoneProgress.map((ms) => (
            <MilestoneChip key={ms.target} milestone={ms} />
          ))}
        </div>
      )}

      {/* Growth rate footer */}
      <div className="flex items-center gap-4 pt-3 border-t border-outline-variant text-label-small">
        <span className="text-on-surface-variant">
          Current:{" "}
          <span
            className={
              onTrack
                ? "text-green-600 font-medium"
                : "text-on-surface font-medium"
            }
          >
            {currentGrowthRate.toFixed(2)} users/day
          </span>
        </span>
        <span className="text-on-surface-variant">
          Required:{" "}
          <span className="font-medium text-on-surface">
            {requiredGrowthRate.toFixed(2)} users/day
          </span>
        </span>
        {!onTrack && (
          <span className="text-amber-600 font-medium">
            {acceleration}x acceleration needed
          </span>
        )}
      </div>
    </div>
  );
}

function DaysRemainingBadge({
  days,
  onTrack,
}: {
  days: number;
  onTrack: boolean;
}) {
  const urgencyClass =
    days <= 30
      ? "bg-red-100 text-red-700"
      : days <= 90
        ? "bg-amber-100 text-amber-700"
        : onTrack
          ? "bg-green-100 text-green-700"
          : "bg-surface-container-high text-on-surface-variant";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-label-small font-medium ${urgencyClass}`}
    >
      {days}d remaining
    </span>
  );
}

function MilestoneChip({
  milestone,
}: {
  milestone: {
    target: number;
    label: string;
    reached: boolean;
    reachedAt?: string;
    projectedDate?: string;
  };
}) {
  if (milestone.reached) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-label-small font-medium text-green-700">
        <CheckIcon />
        {milestone.label}
      </span>
    );
  }

  const projectedLabel = milestone.projectedDate
    ? `Est. ${new Date(milestone.projectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "Pending";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1 text-label-small text-on-surface-variant">
      {milestone.label} — {projectedLabel}
    </span>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-5 w-5 text-primary"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GrowthProgressError() {
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <TargetIcon className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-title-medium font-medium text-on-surface">
            Growth Goal
          </h3>
          <p className="text-label-small text-on-surface-variant">
            Unable to load goal progress. Check your connection and refresh.
          </p>
        </div>
      </div>
    </div>
  );
}

function GrowthProgressEmpty() {
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <TargetIcon />
        </div>
        <div>
          <h3 className="text-title-medium font-medium text-on-surface">
            Growth Goal
          </h3>
          <p className="text-label-small text-on-surface-variant">
            No active growth goal set. Create one in the database to track
            progress.
          </p>
        </div>
      </div>
    </div>
  );
}

function GrowthProgressSkeleton() {
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-surface-container-high" />
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-surface-container-high" />
          <div className="h-3 w-64 rounded bg-surface-container-high" />
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface-container-high mb-4" />
      <div className="flex gap-2">
        <div className="h-7 w-24 rounded-full bg-surface-container-high" />
        <div className="h-7 w-28 rounded-full bg-surface-container-high" />
      </div>
    </div>
  );
}
