"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowRight } from "lucide-react";
import { fetchOnboardingState, dismissBeaconTask } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";

/**
 * Map-sidebar "Try next" nudge: surfaces the next Pro features a trial/pro user
 * hasn't tried yet, addressing the gap that the map offered no feature discovery
 * (the dashboard already has ProgressChecklist; the beacon coachmarks are dormant).
 *
 * Reuses the existing onboarding spine — `usage_stats` / `onboarding_checklist`
 * tell us what's been done, and dismissal persists server-side via the
 * `dismissed_beacons` array (same mechanism the beacon system uses), so a dismiss
 * sticks across sessions and devices, not just this tab.
 */

/** Single beacon id so a dismiss is recorded once in `dismissed_beacons`. */
const NUDGE_BEACON_ID = "map-try-next";
const MAX_SHOWN = 2;

// Inferred so we don't depend on the named type being re-exported from @/lib/data.
type OnboardingState = NonNullable<
  Awaited<ReturnType<typeof fetchOnboardingState>>
>;

interface ProFeature {
  id: string;
  label: string;
  href: string;
  /** True once the user has already tried this feature (read from onboarding state). */
  done: (state: OnboardingState) => boolean;
}

// High-value Pro features, ordered by value. Completion is derived from the
// existing onboarding_checklist / usage_stats — no new tracking introduced.
const PRO_FEATURES: ProFeature[] = [
  {
    id: "generate_report",
    label: "Generate an AI market report",
    href: "/reports",
    done: (s) =>
      (s.usage_stats?.reports_generated ?? 0) > 0 ||
      s.onboarding_checklist.includes("read_report"),
  },
  {
    id: "screen_markets",
    label: "Screen markets by your criteria",
    href: "/screener",
    done: (s) => s.onboarding_checklist.includes("screen_markets"),
  },
  {
    id: "analyze_property",
    label: "Analyze a specific property",
    href: "/analyzer",
    done: (s) => s.onboarding_checklist.includes("analyze_property"),
  },
  {
    id: "compare_markets",
    label: "Compare two markets side by side",
    href: "/compare/markets",
    done: (s) => s.onboarding_checklist.includes("compare_markets"),
  },
  {
    id: "connect_claude",
    label: "Connect PropertyIQ to Claude",
    href: "/docs/mcp",
    done: (s) => s.onboarding_checklist.includes("connect_claude"),
  },
];

export function FeatureDiscoveryNudge() {
  const { tier, trial } = useEntitlements();
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  // Already cached app-wide (providers prefetch it); this just reads the cache.
  const { data: state } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: Infinity,
  });

  // Only for users who actually have access to these Pro features (trial or paid).
  const hasProAccess =
    !!trial?.active || tier === "pro" || tier === "enterprise";
  if (!state || !hasProAccess) return null;
  if (locallyDismissed || state.dismissed_beacons.includes(NUDGE_BEACON_ID))
    return null;

  const untried = PRO_FEATURES.filter((f) => !f.done(state)).slice(
    0,
    MAX_SHOWN,
  );
  if (untried.length === 0) return null;

  const handleDismiss = () => {
    setLocallyDismissed(true);
    // Best-effort server persistence; local state already hid it this session.
    dismissBeaconTask(NUDGE_BEACON_ID).catch(console.error);
  };

  const heading = trial?.active
    ? "Make the most of your Pro trial"
    : "Make the most of Pro";

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium leading-snug text-on-surface">
          {heading}
        </h3>
        <button
          onClick={handleDismiss}
          className="-mr-1 -mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/60 transition-colors hover:bg-on-surface/8 hover:text-on-surface-variant"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {untried.length} {untried.length === 1 ? "feature" : "features"} you
        haven&rsquo;t tried yet
      </p>
      <div className="mt-3 space-y-1">
        {untried.map((feature) => (
          <Link
            key={feature.id}
            href={feature.href}
            className="group -mx-1 flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-on-surface transition-colors duration-200 hover:bg-primary/10"
          >
            <span className="leading-snug">{feature.label}</span>
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
