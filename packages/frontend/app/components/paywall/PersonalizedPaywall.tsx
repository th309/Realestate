"use client";

import Link from "next/link";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";

interface UsageStats {
  markets_viewed: number;
  scores_checked: number;
  reports_generated: number;
}

interface PersonalizedPaywallProps {
  usageStats: UsageStats;
  featureBlocked?: string;
  geoLevel?: string;
  geoId?: string;
  onDismiss: () => void;
}

export function PersonalizedPaywall({
  usageStats,
  featureBlocked,
  geoLevel,
  geoId,
  onDismiss,
}: PersonalizedPaywallProps) {
  const hasActivity =
    usageStats.markets_viewed > 0 ||
    usageStats.scores_checked > 0 ||
    usageStats.reports_generated > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-surface-container-high rounded-[28px] shadow-lg p-8">
        {featureBlocked && (
          <p className="text-xs text-on-surface-variant mb-4">
            This feature requires a Pro subscription
          </p>
        )}

        <h2 className="text-xl font-medium text-on-surface mb-2">
          {hasActivity
            ? "Keep your market intelligence flowing"
            : "Unlock the full PropertyIQ experience"}
        </h2>

        {geoLevel && geoId && (
          <div className="mb-3">
            <SocialProofBadge
              geoLevel={geoLevel}
              geoId={geoId}
              variant="tracking"
            />
          </div>
        )}

        {hasActivity && (
          <div className="flex gap-4 my-5 py-4 border-y border-outline-variant/20">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-[#00c853]">
                {usageStats.markets_viewed}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Markets
                <br />
                analyzed
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-primary">
                {usageStats.scores_checked}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Scores
                <br />
                viewed
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-warning">
                {usageStats.reports_generated}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Reports
                <br />
                generated
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <Link
            href="/upgrade"
            className="w-full text-center py-3 px-6 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro — $29/mo
          </Link>
          <button
            onClick={onDismiss}
            className="w-full text-center py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
