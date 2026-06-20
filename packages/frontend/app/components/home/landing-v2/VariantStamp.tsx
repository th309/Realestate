"use client";

import { useEffect } from "react";
import { setVariant, trackEvent } from "@/lib/analytics/tracker";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Registers the landing A/B variant with the analytics tracker so every event
 * fired on this page carries `properties.variant`, and emits the single
 * `home.view` pageview for the funnel. Renders nothing.
 *
 * The `variant` prop is the server-known assignment; it falls back to the
 * client-readable `piq-variant` cookie set by middleware.
 */
export function VariantStamp({ variant }: { variant: "A" | "B" }) {
  useEffect(() => {
    const v = variant || readCookie("piq-variant") || "A";
    setVariant(v);
    trackEvent("home.view", { variant: v });
  }, [variant]);

  return null;
}
