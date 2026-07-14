"use client";

/**
 * Dashboard Page
 *
 * Personalized dashboard showing the user's profile summary, top market
 * matches, markets to watch, and watchlist updates.
 *
 * If the user has not completed the onboarding quiz, shows a banner
 * prompting them to /onboarding.
 */

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePreferences, fetchOnboardingState } from "@/lib/data";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProfileSummary } from "./components/ProfileSummary";
import { TopMarketsList } from "./components/TopMarketsList";
import { MarketsToWatch } from "./components/MarketsToWatch";
import { WatchlistUpdates } from "./components/WatchlistUpdates";
import { ProgressChecklist } from "./components/ProgressChecklist";
import { SampleReportCard } from "./components/SampleReportCard";
import { TrialExpirationBanner } from "./components/TrialExpirationBanner";
import { NextBestActionCard } from "./components/NextBestActionCard";
import { useFeatureCoverage } from "@/lib/feature-coverage/useFeatureCoverage";
import { normalizePersona } from "@/lib/feature-coverage/feature-coverage";

// ---------------------------------------------------------------------------
// Onboarding banner (shown when quiz not completed)
// ---------------------------------------------------------------------------

function OnboardingBanner() {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
      <h2 className="text-xl font-medium text-on-surface mb-2">
        Personalize Your Dashboard
      </h2>
      <p className="text-sm text-on-surface-variant mb-4 max-w-md mx-auto">
        Take a quick quiz to tell us your goals, budget, and priorities. We will
        match you with the best markets and tailor your experience.
      </p>
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Take the Quiz
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-surface-container-highest rounded" />
      <div className="h-24 bg-surface-container-low rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 h-80 bg-surface-container-low rounded-xl" />
        <div className="lg:col-span-2 h-80 bg-surface-container-low rounded-xl" />
      </div>
      <div className="h-48 bg-surface-container-low rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { preferences, isLoading: prefsLoading } = usePreferences();
  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
  });

  const coverage = useFeatureCoverage(
    normalizePersona(onboardingState?.user_type),
  );

  const isLoading = authLoading || prefsLoading;
  const quizCompleted = !!preferences?.quiz_completed_at;
  const completedTasks = onboardingState?.onboarding_checklist ?? [];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium text-on-surface">
          {user?.user_metadata?.display_name
            ? `Welcome back, ${user.user_metadata.display_name}`
            : "Your Dashboard"}
        </h1>
        <a
          href="/tour?resume=fresh"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Take the tour
        </a>
      </div>

      {/* Trial expiration banner (visible 4 days before trial ends) */}
      <TrialExpirationBanner
        usageStats={onboardingState?.usage_stats ?? null}
      />

      {/* Return-visit surface: the single highest-value next move for this user */}
      {coverage && (
        <NextBestActionCard
          recommended={coverage.recommendedNext}
          whatsNew={null}
        />
      )}

      {/* Getting-started checklist (hides itself when all done or dismissed) */}
      <ProgressChecklist
        completedTasks={completedTasks}
        dismissedBeacons={onboardingState?.dismissed_beacons ?? []}
      />

      {/* Sample report card for post-trial free users */}
      <SampleReportCard
        onboardingMarket={onboardingState?.onboarding_market ?? null}
      />

      {/* Onboarding banner or profile summary */}
      {!quizCompleted ? (
        <OnboardingBanner />
      ) : (
        <>
          {/* Profile summary (full width) */}
          <ProfileSummary preferences={preferences!} />

          {/* Top matches + Markets to watch (side by side) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <TopMarketsList archetypeId={preferences!.archetype_id} />
            </div>
            <div className="lg:col-span-2">
              <MarketsToWatch />
            </div>
          </div>

          {/* Watchlist updates (full width) */}
          {user?.id && <WatchlistUpdates userId={user.id} />}
        </>
      )}
    </div>
  );
}
