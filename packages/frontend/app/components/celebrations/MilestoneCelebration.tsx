"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MilestoneCelebrationProps {
  title: string;
  message: string;
  bridgeLabel: string;
  bridgeHref: string;
  onDismiss: () => void;
}

export function MilestoneCelebration({
  title,
  message,
  bridgeLabel,
  bridgeHref,
  onDismiss,
}: MilestoneCelebrationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Spring in
    const showTimer = setTimeout(() => setShow(true), 50);
    // Auto-dismiss after 8 seconds
    const hideTimer = setTimeout(() => {
      setShow(false);
      setTimeout(onDismiss, 300);
    }, 8000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] max-w-sm pointer-events-auto"
      style={{
        transform: show
          ? "translateY(0) scale(1)"
          : "translateY(20px) scale(0.95)",
        opacity: show ? 1 : 0,
        transition:
          "transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out",
      }}
    >
      <div className="bg-surface-container-high rounded-2xl shadow-lg border border-outline-variant/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00c853]/10 flex items-center justify-center shrink-0">
            <span className="text-[#00c853] text-sm">✓</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-on-surface">{title}</h4>
            <p className="text-xs text-on-surface-variant mt-0.5">{message}</p>
            <Link
              href={bridgeHref}
              className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:text-primary/80 transition-colors"
              onClick={onDismiss}
            >
              {bridgeLabel} →
            </Link>
          </div>
          <button
            onClick={() => {
              setShow(false);
              setTimeout(onDismiss, 300);
            }}
            className="text-on-surface-variant/40 hover:text-on-surface-variant text-xs shrink-0"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

/** Milestone definitions — each maps to a checklist task ID */
export const MILESTONES: Record<
  string,
  {
    title: string;
    message: string;
    bridgeLabel: string;
    bridgeHref: string;
  }
> = {
  view_score: {
    title: "First score unlocked!",
    message: "You've viewed your first PropertyIQ Score.",
    bridgeLabel: "Compare to another market",
    bridgeHref: "/market",
  },
  generate_report: {
    title: "Report generated!",
    message: "Your AI market analysis is being created.",
    bridgeLabel: "Explore Pro features",
    bridgeHref: "/pricing?from=milestone",
  },
  compare_markets: {
    title: "Market comparison complete!",
    message: "You've compared multiple markets.",
    bridgeLabel: "Generate a full report",
    bridgeHref: "/reports",
  },
  all_complete: {
    title: "You're all set!",
    message: "You've completed all getting-started tasks.",
    bridgeLabel: "Set up market alerts",
    bridgeHref: "/alerts",
  },
};
