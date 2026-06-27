"use client";

import React from "react";
import { MapPin, Calendar, Sparkles, AlertTriangle } from "lucide-react";
import { ReportWithTemplate } from "./types";
import { ReportTemplateType, TemplateSection } from "./templates";
import { SectionIcon, formatSectionName } from "./utils/sectionDisplay";

interface ReportHeroSectionProps {
  report: ReportWithTemplate;
  templateType: ReportTemplateType;
  templateSections: TemplateSection[];
}

/**
 * Classic report hero: type badge, title, meta row, limited-data notice, and
 * table of contents. Redesigned templates (comparison + agent market snapshot)
 * render their own Hero/Overview sections, so this returns null for them.
 */
export function ReportHeroSection({
  report,
  templateType,
  templateSections,
}: ReportHeroSectionProps) {
  if (
    templateType === "comparison" ||
    templateType === "market_snapshot_client" ||
    templateType === "market_snapshot_prep"
  ) {
    return null;
  }

  return (
    <div className="bg-white border-b border-[rgba(27,46,74,0.06)]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="report-animate-in">
          {/* Report Type Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="report-badge report-badge-ready">
              {report.template?.name || "Market Report"}
            </span>
            <span className="text-xs text-[var(--report-stone-light)]">
              Generated {new Date(report.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl md:text-4xl font-semibold text-[var(--report-navy)] tracking-tight mb-4"
            style={{ fontFamily: "var(--report-font-display)" }}
          >
            {report.title}
          </h1>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--report-stone)]">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[var(--report-stone-light)]" />
              <span>{report.primary_geography_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[var(--report-stone-light)]" />
              <span>Data as of {report.data_as_of_date}</span>
            </div>
            {report.ai_model_used && (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--report-stone-light)]" />
                <span>AI-Enhanced</span>
              </div>
            )}
          </div>
        </div>

        {/* Limited Data Coverage Notice */}
        {(report.populated_data as any)?.data_coverage?.is_limited &&
          (() => {
            const dc = (report.populated_data as any).data_coverage;
            return (
              <div
                className="mt-6 rounded-xl p-4 report-animate-in"
                style={{
                  backgroundColor: "rgba(234, 179, 8, 0.08)",
                  border: "1px solid rgba(234, 179, 8, 0.2)",
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--report-navy)] mb-1">
                      Limited Data Coverage
                    </p>
                    <p className="text-sm text-[var(--report-stone)]">
                      {report.primary_geography_name} is a smaller market with
                      limited data from some sources. This report uses{" "}
                      {dc.coverage_pct}% of our standard metrics
                      {dc.missing_categories?.length > 0 && (
                        <>
                          {" "}
                          &mdash; missing: {dc.missing_categories.join(", ")}
                        </>
                      )}
                      . Some sections may use proxy data or Census estimates
                      where primary sources are unavailable.
                      {dc.parent_msa_name && (
                        <>
                          {" "}
                          This area is part of the{" "}
                          <strong>{dc.parent_msa_name}</strong> metro area,
                          which has fuller data coverage.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Table of Contents */}
        {templateSections.length > 1 && (
          <nav className="mt-8 p-5 report-card report-animate-in report-animate-in-delay-1">
            <h3 className="report-label mb-3">In this report</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {templateSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--report-stone)] hover:bg-[var(--report-cream)] hover:text-[var(--report-navy)] transition-colors"
                >
                  <SectionIcon sectionId={section.id} />
                  <span className="truncate">
                    {formatSectionName(section.id)}
                  </span>
                </a>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
