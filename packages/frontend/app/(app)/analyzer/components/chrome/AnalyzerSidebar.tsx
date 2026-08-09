"use client";

import type { ReactNode } from "react";
import type { RentcastPropertyRecord } from "@/lib/data";
import { PropertyRecordCard } from "../PropertyRecordCard";

interface AnalyzerSidebarProps {
  /** The bound `InputPanel`. Shared with the mobile sheet, so it is passed in rather than built here. */
  inputPanel: ReactNode;
  propertyRecord?: RentcastPropertyRecord | null;
}

/**
 * Sticky input column. Hidden below 1140px — the mockup's two-column
 * breakpoint — where the same panel lives in `MobileInputSheet` instead.
 *
 * Plain sticky column, per the mockup's `.side { position: sticky }`: this
 * used to carry a nested vertical scrollbar AND a horizontal one at the same
 * time. The horizontal overflow is fixed at source (`min-w-0` in `NumField`
 * and on the field grid's cells). The max-height stays purely as a
 * reachability guard — a tall variant (commercial underwriting group, flip +
 * BRRRR fields, per-field provenance rows) must still reach its last control
 * rather than sit pinned with its bottom off-screen.
 *
 * Both offsets are derived from `--app-chrome-h` (globals.css: AppBar +
 * GlobalBreadcrumbs) rather than a bare `top-6`, because that chrome is sticky
 * and opaque: pinning 24px from the viewport top parked the column's first
 * ~70px behind it once the page scrolled, and the matching `100dvh - 3rem`
 * over-measured the space actually left below the chrome by the same amount.
 *
 * `h-full` is load-bearing and easy to delete by accident. A sticky element
 * only sticks within its own containing block, so this wrapper has to span the
 * grid row for the panel to follow the scroll. Without it — and with
 * `items-start` on the parent grid, which was the bug — the wrapper collapses
 * to the panel's own height (~950px) against a results column several thousand
 * pixels tall. The inputs then scroll away for most of the page and leave a
 * 344px empty gutter beside every chart.
 */
export function AnalyzerSidebar({
  inputPanel,
  propertyRecord,
}: AnalyzerSidebarProps) {
  return (
    <div className="hidden h-full min-[1140px]:block">
      <div className="sticky top-[calc(var(--app-chrome-h)_+_1rem)] max-h-[calc(100dvh_-_var(--app-chrome-h)_-_2rem)] space-y-4 overflow-y-auto overscroll-contain">
        {inputPanel}
        {propertyRecord && <PropertyRecordCard record={propertyRecord} />}
      </div>
    </div>
  );
}
