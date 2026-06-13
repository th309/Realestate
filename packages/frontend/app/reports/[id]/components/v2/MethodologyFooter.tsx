"use client";

import React from "react";
import { FileText, ExternalLink, Database, ShieldCheck } from "lucide-react";

interface MethodologyFooterProps {
  /** 'homebuyer' | 'investor' — determines which methodology summary to show */
  userType: string;
  /** Score type displayed in this report (e.g. 'homeready', 'investoredge') */
  scoreType?: string;
  /** Confidence level letter if available */
  confidenceLevel?: "a" | "b" | "c" | "f";
  /** Confidence percentage (0-100) */
  confidencePercentage?: number;
  /** ISO date string for data freshness */
  dataAsOfDate?: string;
  /** Report generation date */
  generatedDate?: string;
}

/** Confidence level colors matching the scoring system */
const CONFIDENCE_COLORS: Record<string, string> = {
  a: "text-emerald-600 bg-emerald-50",
  b: "text-amber-600 bg-amber-50",
  c: "text-rose-600 bg-rose-50",
  f: "text-red-600 bg-red-50",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  a: "High Confidence",
  b: "Good Confidence",
  c: "Fair Confidence",
  f: "Low Confidence",
};

function getScoreDescription(scoreType?: string): string {
  // One score across all reports: the PropertyIQ Score. The scoreType param is
  // retained for callers/back-compat, but every report shows the same copy.
  void scoreType;
  return "The PropertyIQ Score predicts which markets will outperform their state over the next 3 years, combining Zillow price momentum with Realtor.com market-flow signals (days on market and price cuts).";
}

/**
 * MethodologyFooter — appears at the bottom of every v2 report.
 * Provides an "About This Analysis" section with validation evidence,
 * data source attribution, and methodology transparency.
 */
export function MethodologyFooter({
  userType,
  scoreType,
  confidenceLevel,
  confidencePercentage,
  dataAsOfDate,
  generatedDate,
}: MethodologyFooterProps) {
  const formattedDate = dataAsOfDate
    ? new Date(dataAsOfDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const formattedGenerated = generatedDate
    ? new Date(generatedDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const confidenceColor = confidenceLevel
    ? CONFIDENCE_COLORS[confidenceLevel] || ""
    : "";
  const confidenceLabel = confidenceLevel
    ? CONFIDENCE_LABELS[confidenceLevel] || ""
    : "";

  return (
    <footer className="mt-12 pt-8 border-t border-outline-variant">
      <div className="bg-surface-container-low rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="text-base font-medium text-on-surface">
            About This Analysis
          </h3>
        </div>

        {/* Score description */}
        <p className="text-sm text-on-surface-variant mb-4">
          {getScoreDescription(scoreType)}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Confidence */}
          {confidenceLevel && (
            <div className="flex items-start gap-3">
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${confidenceColor}`}
              >
                {confidenceLevel.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-on-surface">
                  {confidenceLabel}
                </p>
                {confidencePercentage != null && (
                  <p className="text-xs text-on-surface-variant">
                    {confidencePercentage}% data coverage
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data sources */}
          <div className="flex items-start gap-3">
            <Database className="w-4 h-4 text-on-surface-variant mt-0.5" />
            <div>
              <p className="text-sm font-medium text-on-surface">
                6 Data Sources
              </p>
              <p className="text-xs text-on-surface-variant">
                Zillow, Redfin, Realtor.com, Census, BLS, FRED
              </p>
            </div>
          </div>

          {/* Validation */}
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-on-surface-variant mt-0.5" />
            <div>
              <p className="text-sm font-medium text-on-surface">
                Validated Across 924 Metros
              </p>
              <p className="text-xs text-on-surface-variant">
                {userType === "investor"
                  ? "70% OOS hit rate (PropertyIQ)"
                  : "64% OOS hit rate (PropertyIQ)"}
              </p>
            </div>
          </div>
        </div>

        {/* Methodology link + dates */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-outline-variant">
          <div className="flex items-center gap-4">
            <a
              href="/scores/methodology"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <FileText className="w-3.5 h-3.5" />
              Full Methodology
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-xs text-on-surface-variant">
            {formattedGenerated && <>Report generated {formattedGenerated}</>}
            {formattedDate && <> · Data as of {formattedDate}</>}
            {" · "}Formula v3.0
          </p>
        </div>
      </div>
    </footer>
  );
}
