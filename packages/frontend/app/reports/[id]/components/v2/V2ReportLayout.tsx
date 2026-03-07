"use client";

import React, { useMemo } from "react";
import { V2ReportHeader, V2ReportType } from "./ReportHeader";
import type { ReportInstance } from "../../../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableOfContentsItem {
  /** Unique section ID (used as anchor href) */
  id: string;
  /** Display label for the section */
  label: string;
}

export interface V2ReportLayoutProps {
  /** The report instance data */
  report: ReportInstance;
  /** Table of contents entries for the sidebar */
  tableOfContents: TableOfContentsItem[];
  /** Report content (sections) */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the V2 report type from the report instance for badge display.
 */
function deriveReportType(report: ReportInstance): V2ReportType {
  if (report.user_type === "investor") return "investoredge";
  if (report.user_type === "homebuyer") return "homeready";
  return "custom";
}

/**
 * Formats the generated date for display.
 */
function formatGeneratedDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableOfContentsSidebar({ items }: { items: TableOfContentsItem[] }) {
  if (items.length <= 1) return null;

  return (
    <nav
      className="hidden xl:block fixed left-0 top-[88px] w-56 h-[calc(100vh-88px)] overflow-y-auto py-8 px-4 report-no-print"
      aria-label="Table of contents"
    >
      <p className="report-label mb-4 px-3">Contents</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block px-3 py-2 text-sm text-[var(--report-stone)] hover:text-[var(--report-navy)] hover:bg-[var(--report-cream-dark)] rounded-lg transition-colors truncate"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PrintCoverPage({ report }: { report: ReportInstance }) {
  return (
    <div className="report-print-only report-print-cover">
      <p className="text-sm font-semibold tracking-widest uppercase text-[var(--report-stone-light)] mb-6">
        PropertyIQ
      </p>
      <h1
        className="text-4xl font-semibold text-[var(--report-navy)] tracking-tight mb-4"
        style={{ fontFamily: "var(--report-font-display)" }}
      >
        {report.title}
      </h1>
      <p className="text-lg text-[var(--report-stone)] mb-8">
        {report.primary_geography_name}
      </p>
      <div className="flex items-center justify-center gap-4 text-sm text-[var(--report-stone-light)]">
        <span>{formatGeneratedDate(report.created_at)}</span>
        {report.data_as_of_date && (
          <>
            <span className="text-[var(--report-stone-light)]">&middot;</span>
            <span>Data as of {report.data_as_of_date}</span>
          </>
        )}
      </div>
    </div>
  );
}

function PrintFooter() {
  return (
    <div className="report-print-only report-print-footer">
      PropertyIQ &mdash; Confidential Market Analysis
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * V2ReportLayout - Wrapper layout for v2 reports.
 *
 * Provides:
 * - V2ReportHeader with branded badge, title, metadata
 * - Table of contents sidebar (desktop only, hidden in print)
 * - Clean typography with larger body text and proper heading hierarchy
 * - Print-friendly styling with cover page and running footer
 *
 * This layout is intended for reports where `_meta.version === 'v2'`.
 *
 * @example
 * ```tsx
 * <V2ReportLayout
 *   report={report}
 *   tableOfContents={[
 *     { id: 'executive-verdict', label: 'Executive Verdict' },
 *     { id: 'market-deep-dive', label: 'Market Deep Dive' },
 *     { id: 'scenarios', label: 'Scenario Analysis' },
 *   ]}
 * >
 *   <section id="executive-verdict">...</section>
 *   <section id="market-deep-dive">...</section>
 *   <section id="scenarios">...</section>
 * </V2ReportLayout>
 * ```
 */
export function V2ReportLayout({
  report,
  tableOfContents,
  children,
}: V2ReportLayoutProps): React.ReactElement {
  const reportType = useMemo(
    () => deriveReportType(report),
    [report.user_type],
  );
  const generatedDate = useMemo(
    () => formatGeneratedDate(report.created_at),
    [report.created_at],
  );

  return (
    <div className="report-page min-h-screen v2-report-layout">
      {/* Print-only cover page */}
      <PrintCoverPage report={report} />

      {/* Screen header */}
      <V2ReportHeader
        reportType={reportType}
        marketName={report.primary_geography_name}
        title={report.title}
        generatedDate={generatedDate}
        dataFreshness={report.data_as_of_date ?? undefined}
      />

      {/* Table of Contents sidebar (desktop only) */}
      <TableOfContentsSidebar items={tableOfContents} />

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-10 xl:ml-56 v2-report-body">
        {children}
      </main>

      {/* Print-only footer */}
      <PrintFooter />

      {/* Scoped v2 typography enhancements */}
      <style jsx>{`
        .v2-report-body :global(p) {
          font-size: 1rem;
          line-height: 1.75;
        }
        .v2-report-body :global(h2) {
          font-family: var(--report-font-display);
          font-size: 1.75rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 1.3;
          color: var(--report-navy);
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }
        .v2-report-body :global(h3) {
          font-family: var(--report-font-display);
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.4;
          color: var(--report-navy);
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .v2-report-body :global(h4) {
          font-family: var(--report-font-body);
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.5;
          color: var(--report-navy);
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        @media print {
          .v2-report-layout :global(.report-no-print) {
            display: none !important;
          }
          .v2-report-body {
            margin-left: 0 !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
