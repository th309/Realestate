"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";
import { DashboardScoreBadge } from "./DashboardScoreBadge";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";

interface ScoreData {
  score: number;
}

interface ScoreColumnProps {
  activeView: "investor" | "homebuyer";
  primaryScore: ScoreData | null | undefined;
  marketHealthScore?: ScoreData | null | undefined;
  geoLevel: string;
  geoId: string;
}

export function ScoreColumn({
  activeView,
  primaryScore,
  geoLevel,
  geoId,
}: ScoreColumnProps) {
  return (
    <div className="lg:col-span-4 space-y-6">
      {/* Main Score Card */}
      <motion.div
        data-tour="propertyiq-score"
        className="bg-surface-container rounded-3xl p-8 border border-outline-variant/30 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          key={activeView}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-4"
        >
          {primaryScore?.score != null ? (
            <ScoreDisplay
              value={primaryScore.score}
              size={160}
              strokeWidth={10}
              showLabel={true}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-full border-4 border-surface-container-highest"
              style={{ width: 160, height: 160 }}
            >
              <span className="text-2xl font-bold text-on-surface-variant">
                {"\u2014"}
              </span>
              <span className="text-xs text-on-surface-variant mt-1">
                Unavailable
              </span>
            </div>
          )}
        </motion.div>

        <p className="text-on-surface-variant">PropertyIQ Score</p>
        <Link
          href="/scores/methodology"
          className="mt-1 inline-block text-xs text-primary hover:text-primary/80 transition-colors"
        >
          How it&apos;s calculated →
        </Link>
        <div className="mt-3">
          <SocialProofBadge
            geoLevel={geoLevel}
            geoId={geoId}
            variant="score_checks"
          />
        </div>
      </motion.div>
    </div>
  );
}
