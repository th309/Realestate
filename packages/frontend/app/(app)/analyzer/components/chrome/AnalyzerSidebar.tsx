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
 */
export function AnalyzerSidebar({
  inputPanel,
  propertyRecord,
}: AnalyzerSidebarProps) {
  return (
    <div className="hidden min-[1140px]:block">
      <div className="sticky top-6 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto overscroll-contain">
        {inputPanel}
        {propertyRecord && <PropertyRecordCard record={propertyRecord} />}
      </div>
    </div>
  );
}
