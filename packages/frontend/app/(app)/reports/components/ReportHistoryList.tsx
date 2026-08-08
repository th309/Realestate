"use client";

import { useRouter } from "next/navigation";
import { BarChart3, ChevronRight, GitCompare } from "lucide-react";
import type { ReportListItem } from "../types";
import {
  groupReportHistory,
  isComparisonReport,
  splitReportTitle,
} from "../lib/report-history-grouping";

/**
 * Recent reports list.
 *
 * Three defects from the live page are fixed here. Titles clipped mid-word
 * ("Frederick County, M…", "Tampa-St. Petersbu…") — the ellipsis landed inside
 * the state abbreviation, so they now wrap to two lines instead of truncating.
 * Repeated runs of the same report were indistinguishable — same title, same
 * date, nothing else on the row — so they collapse into one row with a version
 * count. And every row now carries a type badge, because a title alone does
 * not say whether a row is a single-market report or a four-market comparison.
 */
export function ReportHistoryList({ reports }: { reports: ReportListItem[] }) {
  const router = useRouter();
  const groups = groupReportHistory(reports);

  return (
    <ul className="divide-y divide-outline-variant/50 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      {groups.map(({ latest, versions }) => {
        const isComparison = isComparisonReport(latest);
        const { title, type } = splitReportTitle(latest);
        return (
          <li key={latest.id}>
            <button
              type="button"
              onClick={() => router.push(`/reports/${latest.id}`)}
              className="group flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-primary-container/40"
            >
              <span
                aria-hidden
                className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary-container text-on-primary-container"
              >
                {isComparison ? (
                  <GitCompare className="size-4" />
                ) : (
                  <BarChart3 className="size-4" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                {/* No truncate: the live rows clipped inside the state code. */}
                <span className="block text-[13px] font-bold leading-tight text-on-surface">
                  {title}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-on-surface-variant">
                  <span>{type}</span>
                  {latest.primary_geography_name && (
                    <>
                      <span aria-hidden className="text-outline">
                        ·
                      </span>
                      <span>{latest.primary_geography_name}</span>
                    </>
                  )}
                  <span aria-hidden className="text-outline">
                    ·
                  </span>
                  <span className="font-mono tabular-nums">
                    {new Date(latest.created_at).toLocaleDateString()}
                  </span>
                  {versions.length > 1 && (
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10.5px] font-bold text-on-surface">
                      {versions.length} versions
                    </span>
                  )}
                </span>
              </span>

              <ChevronRight className="mt-1 size-4 flex-none text-on-surface-variant transition-colors group-hover:text-primary" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
