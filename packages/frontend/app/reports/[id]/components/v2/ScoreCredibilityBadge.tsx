"use client";

import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck } from "lucide-react";

interface ScoreCredibilityBadgeProps {
  /** Which score type this badge is for */
  scoreType?: "homeready" | "investoredge" | "markethealth";
  /** Override the metros count (defaults to 924) */
  metrosValidated?: number;
  /** Override the hit rate (defaults based on scoreType) */
  hitRate?: string;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional class names */
  className?: string;
}

/** Default hit rates by score type (from v3 validation report OOS results) */
const DEFAULT_HIT_RATES: Record<string, string> = {
  homeready: "63.8%",
  investoredge: "69.5%",
  markethealth: "66.6%",
};

/** Quintile spread by score type (from v3 validation report OOS results) */
const QUINTILE_SPREADS: Record<string, string> = {
  homeready: "2.66 pp",
  investoredge: "5.55 pp",
  markethealth: "3.76 pp",
};

/** Information coefficients by score type (from v3 OOS) */
const INFORMATION_COEFFICIENTS: Record<string, string> = {
  homeready: "0.30",
  investoredge: "0.37",
  markethealth: "0.37",
};

/**
 * ScoreCredibilityBadge — small inline badge near score displays that
 * communicates validation credibility. Shows a brief validation summary
 * with a tooltip containing detailed backtest statistics.
 */
export function ScoreCredibilityBadge({
  scoreType = "homeready",
  metrosValidated = 924,
  hitRate,
  variant = "default",
  className = "",
}: ScoreCredibilityBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const resolvedHitRate = hitRate || DEFAULT_HIT_RATES[scoreType] || "64%";
  const quintileSpread = QUINTILE_SPREADS[scoreType] || "2.66 pp";
  const informationCoefficient = INFORMATION_COEFFICIENTS[scoreType] || "0.30";

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showTooltip) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTooltip]);

  const scoreLabel =
    scoreType === "investoredge"
      ? "InvestorEdge"
      : scoreType === "markethealth"
        ? "Market Health"
        : "HomeReady";

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-on-surface-variant ${className}`}
        title={`Validated across ${metrosValidated}+ metros with ${resolvedHitRate} out-of-sample accuracy`}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-500" />
        Validated
      </span>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Badge */}
      <div
        ref={badgeRef}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
          bg-emerald-50 text-emerald-700 text-xs font-medium cursor-pointer
          hover:bg-emerald-100 transition-colors duration-200
          border border-emerald-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((prev) => !prev)}
        role="button"
        aria-label={`Validation details for ${scoreLabel} score`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShowTooltip((prev) => !prev);
          }
        }}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>
          Validated · {metrosValidated}+ metros · {resolvedHitRate} accuracy
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-0 mb-2 w-72
            bg-surface-container-high rounded-xl shadow-lg
            border border-outline-variant p-4"
          role="tooltip"
        >
          <h4 className="text-sm font-medium text-on-surface mb-2">
            {scoreLabel} Validation Summary
          </h4>

          <div className="space-y-2 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>Metros validated</span>
              <span className="font-medium text-on-surface">
                {metrosValidated}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Out-of-sample accuracy</span>
              <span className="font-medium text-on-surface">
                {resolvedHitRate}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Quintile spread (OOS)</span>
              <span className="font-medium text-on-surface">
                {quintileSpread}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Information coefficient</span>
              <span className="font-medium text-on-surface">
                {informationCoefficient}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Walk-forward windows</span>
              <span className="font-medium text-on-surface">4</span>
            </div>
            <div className="flex justify-between">
              <span>Backtest period</span>
              <span className="font-medium text-on-surface">2018-2023</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-outline-variant">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Scores are validated using walk-forward cross-validation where the
              model never sees future data. All accuracy metrics are
              out-of-sample.
            </p>
          </div>

          {/* Tooltip arrow */}
          <div
            className="absolute -bottom-1.5 left-6 w-3 h-3
              bg-surface-container-high border-r border-b border-outline-variant
              transform rotate-45"
          />
        </div>
      )}
    </div>
  );
}
