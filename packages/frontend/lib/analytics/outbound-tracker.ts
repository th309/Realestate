/**
 * Outbound link click tracking.
 *
 * This is the closest achievable answer to "where does a user go after they
 * leave our site". A browser gives the departing page no visibility into where
 * a navigation lands, so the destination has to be captured at CLICK time,
 * before unload. Anything the user reaches by typing a URL, using a bookmark,
 * or closing the tab is unknowable by design — not a gap we can close.
 *
 * Uses one delegated capture-phase listener on the document rather than
 * per-link handlers, so links rendered later (report citations, news items,
 * embeds) are covered without any component opting in.
 *
 * DATA LAYER EXEMPTION: Analytics emission, not data fetching.
 */
"use client";

import { useEffect } from "react";
import { trackEvent, flush } from "./tracker";
import { isInternalHost } from "./referrer-classification";

/** Walk up from the event target to the nearest anchor, if any. */
function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest("a");
}

export function useOutboundTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleClick(event: MouseEvent) {
      // Ignore right-clicks; auxclick covers middle-click separately.
      if (event.type === "click" && event.button !== 0) return;

      const anchor = closestAnchor(event.target);
      if (!anchor?.href) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Only real web navigations — skip mailto:, tel:, blob:, javascript:.
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (isInternalHost(url.hostname)) return;

      // Every field is bounded before emission. These land in the `properties`
      // JSONB and are later read back into an admin table, so an unbounded URL
      // would bloat both the stored row and every dashboard fetch.
      trackEvent("outbound.click", {
        destination_domain: url.hostname.slice(0, 253), // max DNS name length
        destination_url: url.href.slice(0, 512),
        link_text: (anchor.textContent ?? "").trim().slice(0, 120) || undefined,
        from_page: window.location.pathname.slice(0, 512),
        opens_new_tab: anchor.target === "_blank",
      });

      // The page may unload immediately. Same-tab navigations would otherwise
      // lose the event to the 5s batch window, so flush now — flush() prefers
      // sendBeacon, which survives unload.
      flush();
    }

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("auxclick", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("auxclick", handleClick, { capture: true });
    };
  }, []);
}
