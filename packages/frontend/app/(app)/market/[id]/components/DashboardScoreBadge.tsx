"use client";

import { motion } from "framer-motion";
import {
  ScoreDisplay,
  getScoreLabel,
  getScoreMomentumArrow,
  SCORE_MOMENTUM_DESCRIPTOR,
} from "@/app/components/scoring/ScoreDisplay";

interface DashboardScoreBadgeProps {
  label: string;
  score: number;
}

export function DashboardScoreBadge({
  label,
  score,
}: DashboardScoreBadgeProps) {
  return (
    <motion.div
      className="flex items-center gap-4 bg-surface-container rounded-xl p-4 border border-outline-variant/30"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <ScoreDisplay
        value={score}
        size={60}
        strokeWidth={5}
        showGrade={true}
        showLabel={false}
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-on-surface">{label}</div>
        <div className="text-xs text-on-surface-variant">
          {getScoreLabel(score)}{" "}
          <span aria-hidden="true">{getScoreMomentumArrow(score)}</span>
        </div>
        <div className="text-[10px] leading-tight text-on-surface-variant/70 mt-0.5">
          {SCORE_MOMENTUM_DESCRIPTOR}
        </div>
      </div>
    </motion.div>
  );
}
