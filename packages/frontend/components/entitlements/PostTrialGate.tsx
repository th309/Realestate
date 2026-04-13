"use client";

import { usePostTrialState } from "@/lib/entitlements/usePostTrialState";
import { PostTrialOverlay } from "./PostTrialOverlay";

interface PostTrialGateProps {
  /** Which feature category this gates */
  feature: "reports" | "markets" | "scores";
  /** Display name for the unlock badge */
  featureName: string;
  /** Content to show greyed-out */
  children: React.ReactNode;
  /** Fallback for non-post-trial users who also lack access */
  fallback?: React.ReactNode;
}

export function PostTrialGate({
  feature,
  featureName,
  children,
  fallback,
}: PostTrialGateProps) {
  const { isPostTrial, usedFeatures, usageSummaries } = usePostTrialState();

  // Post-trial user who used this feature: show greyed content with unlock badge
  if (isPostTrial && usedFeatures[feature]) {
    return (
      <PostTrialOverlay
        featureName={featureName}
        usageSummary={usageSummaries[feature] ?? undefined}
      >
        {children}
      </PostTrialOverlay>
    );
  }

  // Post-trial user who never used this feature: show fallback (normal paywall)
  if (isPostTrial && !usedFeatures[feature]) {
    return <>{fallback ?? null}</>;
  }

  // Not post-trial (active trial, paid, or no trial history): render children
  return <>{children}</>;
}
