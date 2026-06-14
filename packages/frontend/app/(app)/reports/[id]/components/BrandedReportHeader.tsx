"use client";

import React from "react";
import { ArrowLeft, Share2, Printer, ExternalLink } from "lucide-react";
import type { OrgBranding } from "@/lib/data";

interface BrandedReportHeaderProps {
  branding: OrgBranding;
  reportTitle: string;
  geographyName: string;
  reportDate: string;
  onBack?: () => void;
  onShare?: () => void;
  onPrint?: () => void;
}

/**
 * Branded report header shown when a report belongs to an organization.
 * Displays the org logo, accent color bar, and "Powered by PropertyIQ" attribution.
 */
export function BrandedReportHeader({
  branding,
  reportTitle,
  geographyName,
  reportDate,
  onBack,
  onShare,
  onPrint,
}: BrandedReportHeaderProps) {
  const accentColor = branding.accent_color || "#2563eb";

  return (
    <header className="sticky top-0 z-40 bg-[var(--report-cream)] backdrop-blur-sm report-no-print">
      {/* Accent color top border */}
      <div
        className="h-1 w-full print-color-exact"
        style={{ backgroundColor: accentColor }}
      />

      <div className="max-w-6xl mx-auto px-6 py-3 border-b border-[rgba(27,46,74,0.08)]">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + Report info */}
          <div className="flex items-center gap-4 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="report-btn-ghost shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {/* Org logo or fallback icon */}
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={`${branding.org_name} logo`}
                className="h-10 max-w-[160px] object-contain shrink-0 print:h-8"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg print:w-8 print:h-8 print:text-sm"
                style={{ backgroundColor: accentColor }}
              >
                {branding.org_name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Report title + metadata */}
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-[var(--report-navy)] truncate">
                {reportTitle}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[var(--report-stone-light)]">
                <span>{geographyName}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{reportDate}</span>
              </div>
            </div>
          </div>

          {/* Right: Attribution + Actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Prepared by / Powered by */}
            <div className="hidden md:block text-right">
              <p className="text-xs font-medium text-[var(--report-navy)]">
                Prepared by{" "}
                {branding.website_url ? (
                  <a
                    href={branding.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-0.5"
                    style={{ color: accentColor }}
                  >
                    {branding.org_name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span style={{ color: accentColor }}>
                    {branding.org_name}
                  </span>
                )}
              </p>
              <p className="text-[9px] text-[var(--report-stone-light)] print:text-[9px]">
                Powered by PropertyIQ
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {onShare && (
                <button
                  onClick={onShare}
                  className="report-btn-ghost"
                  title="Share report"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {onPrint && (
                <button
                  onClick={onPrint}
                  className="report-btn-ghost"
                  title="Print report"
                >
                  <Printer className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx>{`
        .print-color-exact {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          header {
            position: static !important;
          }
        }
      `}</style>
    </header>
  );
}
