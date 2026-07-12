"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ALL_NAV_ITEMS, type NavItem } from "./header-nav-data";

/**
 * M3 bottom navigation bar — always mounted on mobile/tablet (`lg:hidden`),
 * browser and installed PWA alike. Mirrors the active-route logic Header.tsx
 * uses for its top-level links (pathname === href, or startsWith for nested
 * routes) so active state agrees between the two chromes.
 *
 * Not mounted here — a separate controller task wires this into AppShell.
 * See the height/clearance contract on `BOTTOM_NAV_HEIGHT_PX` below.
 */

/** Base bar height in px (excludes the safe-area inset, which is additive). */
export const BOTTOM_NAV_HEIGHT_PX = 64;

/** Total fixed-bar height including the iOS home-indicator safe area. */
const BOTTOM_NAV_TOTAL_HEIGHT = `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`;

/**
 * The 5 primary destinations, pulled from the single NAV source of truth in
 * header-nav-data.ts (no duplicate labels/icons/hrefs). All 5 already exist
 * there as discrete NavItem entries, so this is a read-only filter — order
 * follows NAV's own ordering (Maps, Markets, Screener, Reports, Scores).
 */
const BOTTOM_NAV_HREFS = [
  "/map",
  "/market",
  "/screener",
  "/reports",
  "/scores",
];

const BOTTOM_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) =>
  BOTTOM_NAV_HREFS.includes(item.href),
);

/**
 * Routes where a bottom tab bar hurts more than helps: auth flows,
 * onboarding, embeds (third-party iframes), and tokenized shared/print
 * report views. Prefix match so nested routes (e.g. /auth/sign-in) are
 * covered without listing every leaf page.
 */
const HIDDEN_ROUTE_PREFIXES = ["/auth", "/onboarding", "/embed", "/shared"];

function isHiddenRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isActiveDestination(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export function BottomNavBar() {
  const pathname = usePathname();

  if (isHiddenRoute(pathname)) return null;

  return (
    <>
      {/* Flow spacer: the nav below is `fixed`, so this reserves the same
          height at the end of the page flow — content and footer scroll clear
          of the bar instead of being hidden behind it. Rendered here (not as
          padding on <main>) so blocklisted routes get neither bar nor gap. */}
      <div
        aria-hidden
        className="lg:hidden w-full shrink-0"
        style={{ height: BOTTOM_NAV_TOTAL_HEIGHT }}
      />
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around bg-surface-container border-t border-outline-variant pb-safe"
        style={
          {
            height: BOTTOM_NAV_TOTAL_HEIGHT,
            "--piq-bottom-nav-height": BOTTOM_NAV_TOTAL_HEIGHT,
          } as React.CSSProperties
        }
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = isActiveDestination(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 transition-transform duration-200 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <span
                className={`flex items-center justify-center h-8 px-4 rounded-full transition-colors duration-200 ${
                  isActive ? "bg-secondary-container" : "bg-transparent"
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    isActive
                      ? "text-on-secondary-container"
                      : "text-on-surface-variant"
                  }`}
                />
              </span>
              <span
                className={`text-[12px] leading-none font-medium ${
                  isActive ? "text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
