"use client";

import { useEntitlements } from "@/lib/entitlements";

export function TrialBadge() {
  const { trial } = useEntitlements();

  if (!trial?.active || trial.daysRemaining == null) return null;

  const urgency =
    trial.daysRemaining <= 3
      ? "bg-error/10 text-error"
      : trial.daysRemaining <= 7
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${urgency} transition-colors duration-200`}
    >
      <span className="font-mono">{trial.daysRemaining}d</span>
      <span className="hidden sm:inline">Pro Trial</span>
    </span>
  );
}
