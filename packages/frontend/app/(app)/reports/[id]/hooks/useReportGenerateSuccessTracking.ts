"use client";

import { useCallback, useRef } from "react";
import { trackEvent } from "@/lib/analytics/tracker";

/**
 * `feature.report_view` fires for ANY report open — including re-opening an old
 * one — so it cannot answer "did a generation just finish?". This latches on the
 * generating -> ready transition the viewer's poll loop actually observes, which
 * only happens for a report the user watched generate.
 */
export function useReportGenerateSuccessTracking(reportId: string) {
  const pollStartedAt = useRef(Date.now());
  const sawGenerating = useRef(false);
  const fired = useRef(false);

  return useCallback(
    (status: string | undefined) => {
      if (fired.current) return;
      if (status === "generating") {
        sawGenerating.current = true;
        return;
      }
      // "failed" and "expired" are terminal but are not successes.
      if (!sawGenerating.current || status !== "ready") return;
      fired.current = true;
      trackEvent("feature.report_generate_success", {
        report_id: reportId,
        generation_seconds: Math.round(
          (Date.now() - pollStartedAt.current) / 1000,
        ),
      });
    },
    [reportId],
  );
}
