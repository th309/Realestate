"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Intersection Observer hook for scroll-triggered animations.
 *
 * Progressive enhancement approach:
 * - Defaults to visible (inView = true) so content is always readable
 *   on SSR, no-JS, and for prefers-reduced-motion users.
 * - Only animates elements that are below the fold when JS hydrates.
 * - Elements already in the viewport on load stay visible — no flash.
 */
export function useInView(threshold = 0.1) {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState(true); // Visible by default for SSR & a11y

  useEffect(() => {
    if (!ref) return;

    // Respect prefers-reduced-motion — keep everything visible
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return; // Keep visible
    }

    // If element is already in viewport, keep it visible — don't flash
    const rect = ref.getBoundingClientRect();
    const isCurrentlyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (isCurrentlyVisible) {
      return;
    }

    // Element is below the fold — set up scroll-triggered entrance
    setInView(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);

  const setRefCallback = useCallback((node: HTMLElement | null) => {
    setRef(node);
  }, []);

  return [setRefCallback, inView] as const;
}
