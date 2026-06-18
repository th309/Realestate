"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
// Same-origin in the browser (→ `/backend`) so ad blockers don't block it.
import { API_URL } from "@/lib/data";

type MilestoneKey =
  | "first_market_viewed"
  | "first_comparison"
  | "first_score_explored";

const MILESTONE_TOASTS: Record<
  MilestoneKey,
  { message: string; emoji: string }
> = {
  first_market_viewed: {
    emoji: "🗺️",
    message: "First market explored! You're on your way.",
  },
  first_comparison: {
    emoji: "⚖️",
    message: "First comparison complete! You're comparing markets like a pro.",
  },
  first_score_explored: {
    emoji: "📊",
    message: "First score explored! You're digging into the data.",
  },
};

/**
 * useMilestone — fires an idempotent milestone record request and shows a
 * celebratory toast if this is the user's first time hitting that milestone.
 *
 * Usage:
 *   const { recordMilestone } = useMilestone();
 *   recordMilestone('first_market_viewed');   // call once on the relevant action
 */
export function useMilestone() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const inFlightRef = useRef(new Set<string>());

  const recordMilestone = useCallback(
    async (key: MilestoneKey) => {
      if (!session?.access_token) return;
      // Prevent duplicate in-flight requests for the same key
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);

      try {
        const res = await fetch(`${API_URL}/api/milestones/${key}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { isNew: boolean };
        if (data.isNew) {
          const toast = MILESTONE_TOASTS[key];
          if (toast) showToast(toast.message, toast.emoji);
        }
      } catch {
        // Non-critical — silently ignore network errors
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [session?.access_token, showToast],
  );

  return { recordMilestone };
}
