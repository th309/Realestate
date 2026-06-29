"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { PillTabs } from "@/components/ui/Tabs";
import type { ReportInstance } from "../../../../types";
import { type MarketBundle, shortMarketName } from "./marketBundles";
import { MarketDeepDivePanel } from "./MarketDeepDivePanel";

/**
 * ComparisonDeepDiveAccordion — the per-market FULL reports, demoted to an
 * opt-in drawer below the comparison. The side-by-side comparison is the page;
 * this is here for the reader who then wants one market's complete write-up.
 * Collapsed by default so it never competes with the comparison itself.
 */
export function ComparisonDeepDiveAccordion({
  report,
  bundles,
}: {
  report: ReportInstance;
  bundles: MarketBundle[];
}) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(bundles[0]?.id ?? "");
  const active = bundles.find((b) => b.id === activeId) ?? bundles[0];

  if (bundles.length === 0) return null;

  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-outline-variant bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-container"
      >
        <span className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-on-surface">
              Read each market&rsquo;s full report
            </span>
            <span className="block text-xs text-on-surface-variant">
              The complete single-market write-up for{" "}
              {bundles.map((b) => shortMarketName(b.name)).join(", ")}.
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-outline-variant px-4 pb-6 pt-4 sm:px-6">
          <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-outline-variant/40 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <PillTabs
              options={bundles.map((b) => ({
                value: b.id,
                label: shortMarketName(b.name),
              }))}
              value={active.id}
              onChange={setActiveId}
            />
          </div>
          <MarketDeepDivePanel report={report} bundle={active} />
        </div>
      )}
    </div>
  );
}

export default ComparisonDeepDiveAccordion;
