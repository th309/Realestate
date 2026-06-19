"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Real-user-monitoring beacon for Core Web Vitals (H6).
 *
 * Reports LCP / INP / CLS / FCP / TTFB to GA4 via gtag so field data is
 * actually measurable — at our traffic CrUX is origin-fallback only, with no
 * URL-level data. Uses Next's built-in hook (no extra dependency). Renders
 * nothing; mount alongside <GoogleAnalytics/>. Self-gates on `window.gtag`, so
 * it no-ops when GA isn't configured.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    const gtag =
      typeof window !== "undefined"
        ? (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
        : undefined;
    if (typeof gtag !== "function") return;

    gtag("event", metric.name, {
      // CLS is a unitless ratio; scale ×1000 so GA stores a useful integer.
      value: Math.round(
        metric.name === "CLS" ? metric.value * 1000 : metric.value,
      ),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      non_interaction: true,
    });
  });

  return null;
}
