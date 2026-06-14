"use client";

import React from "react";
import { FileText } from "lucide-react";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

const TEXTAREA_CLASS =
  "w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[72px]";

interface ReportBrandingSectionProps {
  reportHeaderText: string;
  reportFooterText: string;
  reportDisclaimer: string;
  onReportHeaderTextChange: (value: string) => void;
  onReportFooterTextChange: (value: string) => void;
  onReportDisclaimerChange: (value: string) => void;
}

/**
 * Report & Document Branding section — header, footer, and disclaimer text
 * for branded PDF reports.
 */
export function ReportBrandingSection({
  reportHeaderText,
  reportFooterText,
  reportDisclaimer,
  onReportHeaderTextChange,
  onReportFooterTextChange,
  onReportDisclaimerChange,
}: ReportBrandingSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            Report &amp; Document Branding
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Customize text shown on PDF reports and shared documents
          </p>
        </div>
      </div>

      {/* Report Header Text */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Report Header Text
        </label>
        <textarea
          value={reportHeaderText}
          onChange={(e) => onReportHeaderTextChange(e.target.value)}
          placeholder="e.g. Prepared by Acme Realty Group"
          className={TEXTAREA_CLASS}
          rows={2}
        />
      </div>

      {/* Report Footer Text */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Report Footer Text
        </label>
        <textarea
          value={reportFooterText}
          onChange={(e) => onReportFooterTextChange(e.target.value)}
          placeholder="e.g. © 2026 Acme Realty Group. All rights reserved."
          className={TEXTAREA_CLASS}
          rows={2}
        />
      </div>

      {/* Report Disclaimer */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Report Disclaimer
        </label>
        <textarea
          value={reportDisclaimer}
          onChange={(e) => onReportDisclaimerChange(e.target.value)}
          placeholder="Legal disclaimer text..."
          className={TEXTAREA_CLASS}
          rows={3}
        />
        <p className="text-xs text-on-surface-variant mt-1">
          Legal disclaimer shown at the bottom of reports
        </p>
      </div>
    </div>
  );
}
