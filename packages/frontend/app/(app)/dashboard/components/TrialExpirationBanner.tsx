"use client";

import Link from "next/link";
import { useEntitlements } from "@/lib/entitlements";

interface TrialExpirationBannerProps {
  usageStats: {
    markets_viewed: number;
    scores_checked: number;
    reports_generated: number;
  } | null;
}

export function TrialExpirationBanner({
  usageStats,
}: TrialExpirationBannerProps) {
  const { trial } = useEntitlements();

  if (!trial?.active || trial.daysRemaining == null || trial.daysRemaining > 4)
    return null;

  const stats = usageStats ?? {
    markets_viewed: 0,
    scores_checked: 0,
    reports_generated: 0,
  };
  const hasActivity =
    stats.markets_viewed > 0 ||
    stats.scores_checked > 0 ||
    stats.reports_generated > 0;

  const urgencyColor =
    trial.daysRemaining <= 1
      ? "border-error/30 bg-error/5"
      : "border-warning/30 bg-warning/5";

  const urgencyText = trial.daysRemaining <= 1 ? "text-error" : "text-warning";

  return (
    <div className={`rounded-2xl border p-5 ${urgencyColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className={`text-sm font-medium ${urgencyText}`}>
            {trial.daysRemaining === 0
              ? "Your Pro trial ends today"
              : trial.daysRemaining === 1
                ? "Your Pro trial ends tomorrow"
                : `Pro trial ends in ${trial.daysRemaining} days`}
          </h3>

          {hasActivity && (
            <p className="text-xs text-on-surface-variant mt-1">
              You&apos;ve analyzed {stats.markets_viewed} markets, viewed{" "}
              {stats.scores_checked} scores, and generated{" "}
              {stats.reports_generated} reports during your trial.
            </p>
          )}

          {!hasActivity && (
            <p className="text-xs text-on-surface-variant mt-1">
              Explore PropertyIQ before your trial ends — search markets, view
              scores, and generate reports.
            </p>
          )}
        </div>

        <Link
          href="/upgrade"
          className="shrink-0 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          Keep Pro
        </Link>
      </div>
    </div>
  );
}
