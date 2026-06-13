"use client";

import React from "react";
import { MapPin, Calendar, Database, Cpu, User } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type V2ReportType = "homeready" | "investoredge" | "custom";

export interface V2ReportHeaderProps {
  /** Report type for badge styling */
  reportType: V2ReportType;
  /** Market / geography name */
  marketName: string;
  /** Primary report title */
  title: string;
  /** Optional subtitle or tagline */
  subtitle?: string;
  /** Date the report was generated */
  generatedDate: string;
  /** Data freshness indicator (e.g. "2026-03-01") */
  dataFreshness?: string;
  /** Score version identifier */
  scoreVersion?: string;
  /** Name of the user who requested the report */
  userName?: string;
}

// ---------------------------------------------------------------------------
// Badge Config
// ---------------------------------------------------------------------------

const REPORT_TYPE_BADGES: Record<
  V2ReportType,
  { label: string; className: string }
> = {
  homeready: {
    label: "Market Analysis",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  investoredge: {
    label: "Market Analysis",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  custom: {
    label: "Custom Research",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetadataItem({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-[var(--report-stone)]">
      <Icon className="w-4 h-4 text-[var(--report-stone-light)] flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * V2ReportHeader - Professional branded header for v2 reports.
 *
 * Displays a clean, premium header with report type badge, large title,
 * subtitle, and a metadata row. Includes subtle PropertyIQ branding.
 *
 * @example
 * ```tsx
 * <V2ReportHeader
 *   reportType="homeready"
 *   marketName="Austin-Round Rock, TX"
 *   title="Austin Metro Market Analysis"
 *   subtitle="A comprehensive look at homebuyer readiness in the Austin metro area"
 *   generatedDate="March 7, 2026"
 *   dataFreshness="2026-03-01"
 *   scoreVersion="v3.2"
 * />
 * ```
 */
export function V2ReportHeader({
  reportType,
  marketName,
  title,
  subtitle,
  generatedDate,
  dataFreshness,
  scoreVersion,
  userName,
}: V2ReportHeaderProps): React.ReactElement {
  const badge = REPORT_TYPE_BADGES[reportType];

  return (
    <header className="bg-white border-b border-[rgba(29,27,32,0.06)] report-animate-in">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Badge Row */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="text-xs text-[var(--report-stone-light)]">
            PropertyIQ
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-3xl md:text-4xl font-semibold text-[var(--report-navy)] tracking-tight mb-3"
          style={{ fontFamily: "var(--report-font-display)" }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-lg text-[var(--report-stone)] leading-relaxed mb-6 max-w-2xl">
            {subtitle}
          </p>
        )}

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <MetadataItem icon={MapPin}>{marketName}</MetadataItem>
          <MetadataItem icon={Calendar}>{generatedDate}</MetadataItem>
          {dataFreshness && (
            <MetadataItem icon={Database}>
              Data as of {dataFreshness}
            </MetadataItem>
          )}
          {scoreVersion && (
            <MetadataItem icon={Cpu}>Score {scoreVersion}</MetadataItem>
          )}
          {userName && (
            <MetadataItem icon={User}>Prepared for {userName}</MetadataItem>
          )}
        </div>
      </div>
    </header>
  );
}
