"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "./tracker";

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

/**
 * Tracks scroll depth milestones (25%, 50%, 75%, 100%) using
 * IntersectionObserver on sentinel elements injected at each
 * milestone position in the document body.
 *
 * Fires `engagement.scroll_depth` once per milestone per page load.
 * Cleans up observers and sentinels on unmount or path change.
 */
export function useScrollDepthTracker(): void {
  const pathname = usePathname();
  const firedRef = useRef<Set<number>>(new Set());
  const sentinelsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Reset fired milestones on new page
    firedRef.current = new Set();

    // Create sentinel elements at each milestone depth
    const sentinels: HTMLElement[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const depth = Number(entry.target.getAttribute("data-scroll-depth"));
          if (!depth || firedRef.current.has(depth)) continue;

          firedRef.current.add(depth);
          trackEvent("engagement.scroll_depth", {
            depth,
            page_path: pathname,
          });

          // Stop observing this sentinel once fired
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0 },
    );

    // Wait a frame for the page to render before measuring document height
    const raf = requestAnimationFrame(() => {
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;

      // Only track if the page is scrollable
      if (docHeight <= viewportHeight) return;

      for (const milestone of SCROLL_MILESTONES) {
        const el = document.createElement("div");
        el.setAttribute("data-scroll-depth", String(milestone));
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.width = "1px";
        el.style.height = "1px";
        el.style.pointerEvents = "none";
        el.style.opacity = "0";

        // Position at the milestone percentage of the scrollable area
        const topPx = Math.min((milestone / 100) * docHeight, docHeight - 1);
        el.style.top = `${topPx}px`;

        document.body.appendChild(el);
        observer.observe(el);
        sentinels.push(el);
      }
      sentinelsRef.current = sentinels;
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const el of sentinelsRef.current) {
        el.remove();
      }
      sentinelsRef.current = [];
    };
  }, [pathname]);
}
