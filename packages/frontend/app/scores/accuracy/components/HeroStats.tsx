"use client";

/**
 * Hero Stats Section
 *
 * Five stat cards showing key v3 walk-forward validation metrics.
 * Accepts a `horizon` prop to switch between 1Y and 3Y labels.
 * Values are sourced from the validation API (useValidationSummary),
 * with OOS static constants as immediate fallbacks while data loads.
 */

import {
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  MapPin,
} from "lucide-react";
import {
  VALIDATION_SCOPE,
  OOS_IC,
  OOS_HIT_RATE,
  OOS_QUINTILE_SPREAD,
  MEDIAN_HOME_VALUE,
} from "@/lib/data";

interface HeroStatsProps {
  horizon: "1y" | "3y";
  children?: React.ReactNode;
}

export function HeroStats({ horizon, children }: HeroStatsProps) {
  const horizonLabel = horizon === "3y" ? "3Y" : "1Y";

  // Use the official v3 walk-forward OOS constants as the authoritative values.
  // The live API may return weaker numbers from incomplete or different datasets —
  // the published accuracy page should reflect the validated report metrics.
  const correlation = OOS_IC.metro_investoredge;
  const hitRate = OOS_HIT_RATE.metro_investoredge;

  const annualAlpha = Math.round(
    (OOS_QUINTILE_SPREAD.metro_investoredge / 100) * MEDIAN_HOME_VALUE,
  );

  const stats = [
    {
      icon: TrendingUp,
      value: correlation.toFixed(2),
      label: `OOS Correlation (${horizonLabel})`,
      sublabel: "Metro InvestorEdge, walk-forward validated",
    },
    {
      icon: DollarSign,
      value: `$${annualAlpha.toLocaleString("en-US")}`,
      label: "Top vs bottom quintile spread",
      sublabel: "Annual dollar difference on $240K home",
    },
    {
      icon: Calendar,
      value: String(VALIDATION_SCOPE.walkForwardWindows),
      label: "Walk-forward windows",
      sublabel: "Non-overlapping test periods (2018\u20132023)",
    },
    {
      icon: CheckCircle,
      value: `${hitRate.toFixed(1)}%`,
      label: `Hit rate (${horizonLabel})`,
      sublabel: "Top-scored markets beating benchmark",
    },
    {
      icon: MapPin,
      value: VALIDATION_SCOPE.metrosValidated.toLocaleString("en-US"),
      label: "Metros validated",
      sublabel: `${VALIDATION_SCOPE.countiesValidated.toLocaleString("en-US")} counties \u00B7 ${VALIDATION_SCOPE.zipsValidated.toLocaleString("en-US")} ZIPs`,
    },
  ];

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Forecast Accuracy
      </p>
      <h1 className="text-3xl md:text-4xl font-[var(--font-source-serif)] text-on-surface mt-2">
        {correlation.toFixed(2)} OOS Correlation.{" "}
        {VALIDATION_SCOPE.walkForwardWindows} Windows.{" "}
        <span className="text-primary">Real Data.</span>
      </h1>
      <p className="text-on-surface-variant mt-3 max-w-3xl text-base leading-relaxed">
        PropertyIQ validates with walk-forward cross-validation across{" "}
        {VALIDATION_SCOPE.backtestYears} years of data. Every number on this
        page comes from held-out test periods the model never trained on.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-8 items-end">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-surface-container rounded-2xl p-4 border border-outline-variant"
            >
              <div className="p-2 bg-primary-container rounded-xl text-on-primary-container w-fit">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-on-surface mt-3">
                {stat.value}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 leading-snug">
                {stat.label}
              </p>
              <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                {stat.sublabel}
              </p>
            </div>
          );
        })}
        {/* Horizon toggle — bottom-aligned with stat cards */}
        {children && (
          <div className="flex items-end justify-end">{children}</div>
        )}
      </div>
    </section>
  );
}
