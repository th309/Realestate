/**
 * Automatic pageview tracking hook for Next.js App Router.
 * Fires on every route change. Tracks page path, previous page, and session context.
 * DATA LAYER EXEMPTION: Analytics emission, not data fetching.
 */
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "./tracker";

export function usePageviewTracker() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    trackEvent("pageview.view", {
      page_path: pathname,
      previous_page_path: previousPathRef.current,
    });

    previousPathRef.current = pathname;
  }, [pathname]);
}
