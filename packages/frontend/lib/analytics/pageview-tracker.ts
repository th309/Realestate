/**
 * Automatic pageview tracking hook for Next.js App Router.
 * Fires on every route change. Tracks page path, previous page, and session context.
 * DATA LAYER EXEMPTION: Analytics emission, not data fetching.
 */
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "./tracker";

/**
 * The previous path lives in sessionStorage rather than a useRef because a ref
 * resets on every full page load. Most visitors arrive on a page and leave
 * without a client-side route change, so a ref left `previous_page_path` null
 * on ~99% of pageviews and navigation-flow panels had nothing to render.
 */
const PREV_PATH_KEY = "piq-prev-path";

function readPreviousPath(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const stored = sessionStorage.getItem(PREV_PATH_KEY);
    if (stored) return stored;
  } catch {
    // sessionStorage unavailable (private mode / blocked cookies).
    return undefined;
  }

  // First pageview of the session: recover the transition from a same-origin
  // referrer, so a hard navigation between our own pages still forms an edge.
  // Cross-origin referrers are acquisition, not an internal flow — those are
  // handled by session-context/referrer-classification instead.
  try {
    if (!document.referrer) return undefined;
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

function storePreviousPath(pathname: string): void {
  try {
    sessionStorage.setItem(PREV_PATH_KEY, pathname);
  } catch {
    // Non-fatal: we simply lose the edge for this visitor.
  }
}

export function usePageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    trackEvent("pageview.view", {
      page_path: pathname,
      previous_page_path: readPreviousPath(),
    });

    storePreviousPath(pathname);
  }, [pathname]);
}
