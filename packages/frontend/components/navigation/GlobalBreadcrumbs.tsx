"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "./Breadcrumbs";
import { isAppChromeRoute } from "@/app/components/app-shell/app-routes";
import {
  ROUTE_LABELS,
  isBreadcrumbExcluded,
} from "@/lib/breadcrumbs/route-config";

function titleCase(segment: string): string {
  return segment
    .split("-")
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" ");
}

/**
 * App-wide breadcrumb bar rendered once under the header (AppShell), so every
 * page gets a consistent breadcrumb without each page wiring its own. Derives
 * the trail from the pathname using ROUTE_LABELS, falling back to a title-cased
 * segment and skipping opaque dynamic ids (numeric / long hashes). Hidden on
 * full-screen / auth / landing routes (see route-config).
 */
export function GlobalBreadcrumbs() {
  const pathname = usePathname() || "/";
  if (isBreadcrumbExcluded(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  const items: { label: string; href?: string }[] = [];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    let label = ROUTE_LABELS[acc];
    if (!label) {
      // Skip opaque dynamic segments (ids, uuids) — never show a raw id.
      if (/^\d+$/.test(seg) || seg.length > 24) continue;
      label = titleCase(seg);
    }
    items.push({ label, href: acc });
  }

  if (items.length === 0) return null;

  // The current page is the last crumb — render it as plain text, not a link.
  items[items.length - 1] = { label: items[items.length - 1].label };

  // This bar sits under whichever top bar AppChrome chose, and the two are
  // different heights — AppBar is 57px, the marketing Header is 65px. The old
  // hardcoded `top-16` (64px) split the difference and was wrong for both: a
  // 7px seam that page content scrolled through on tool routes, and a 1px
  // overlap on the rest. Both tokens live in globals.css and carry the extra
  // safe-area inset in an installed PWA. Written as two whole class strings
  // because Tailwind scans source text — an interpolated name never generates.
  const barOffset = isAppChromeRoute(pathname)
    ? "top-[var(--app-bar-h)]"
    : "top-[var(--site-bar-h)]";

  return (
    // Plain <div> wrapper — the inner <Breadcrumbs> already provides the
    // <nav aria-label="Breadcrumb"> landmark; nesting two would be invalid.
    <div
      className={`sticky ${barOffset} z-40 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur-sm`}
    >
      <div className="mx-auto max-w-[1920px] px-4 py-2 sm:px-6 lg:px-8">
        <Breadcrumbs items={items} showHome className="text-sm" />
      </div>
    </div>
  );
}
