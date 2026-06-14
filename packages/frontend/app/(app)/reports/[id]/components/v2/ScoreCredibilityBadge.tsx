"use client";

import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck } from "lucide-react";

interface ScoreCredibilityBadgeProps {
  /**
   * Retained for backward compatibility with callers from the retired
   * 3-score era. The platform now has a single PropertyIQ Score, so this
   * value is accepted but ignored.
   */
  scoreType?: string;
  /** Override the metros count (defaults to 865) */
  metrosValidated?: number;
  /** Override the positive-validated-years figure (defaults to 100%) */
  hitRate?: string;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional class names */
  className?: string;
}

/**
 * Out-of-sample validation figures for the single PropertyIQ Score (metro
 * level). Source: app/scores/methodology/validation-report.md (2026-06-13).
 */
/** Share of validated years with a positive Information Coefficient. */
const POSITIVE_VALIDATED_YEARS = "100%";
/** Quintile spread (Q5−Q1, annualized 3-year excess vs state). */
const QUINTILE_SPREAD = "1.67 pp";
/** Out-of-sample Information Coefficient (3-year). */
const INFORMATION_COEFFICIENT = "0.27";

/**
 * ScoreCredibilityBadge — small inline badge near score displays that
 * communicates validation credibility. Shows a brief validation summary
 * with a tooltip containing detailed backtest statistics.
 */
export function ScoreCredibilityBadge({
  scoreType: _scoreType,
  metrosValidated = 865,
  hitRate,
  variant = "default",
  className = "",
}: ScoreCredibilityBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const resolvedHitRate = hitRate || POSITIVE_VALIDATED_YEARS;
  const quintileSpread = QUINTILE_SPREAD;
  const informationCoefficient = INFORMATION_COEFFICIENT;

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

  const scoreLabel = "PropertyIQ";

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-on-surface-variant ${className}`}
        title={`Validated across ${metrosValidated}+ metros with ${resolvedHitRate} positive validated years`}
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
          Validated · {metrosValidated}+ metros · {resolvedHitRate} positive
          years
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
              <span>Positive validated years</span>
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
              <span>Permutation significance</span>
              <span className="font-medium text-on-surface">52σ</span>
            </div>
            <div className="flex justify-between">
              <span>Backtest period</span>
              <span className="font-medium text-on-surface">2001–2023</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-outline-variant">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Scores are validated using walk-forward cross-validation where the
              model never sees future data. All validation metrics are
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
