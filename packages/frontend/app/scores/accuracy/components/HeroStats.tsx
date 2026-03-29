"use client";

/**
 * Hero Stats Section
 *
 * Five stat cards showing key v4 PropertyIQ validation metrics.
 * Accepts a `horizon` prop to switch between 1Y and 3Y labels.
 * Values are sourced from V4_CLAIMS (the single PropertyIQ score validation).
 */

import {
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { V4_CLAIMS } from "@/lib/data";

interface HeroStatsProps {
  horizon: "1y" | "3y";
}

export function HeroStats({ horizon }: HeroStatsProps) {
  const is3Y = horizon === "3y";
  const horizonLabel = is3Y ? "3Y" : "1Y";

  const correlation = is3Y ? V4_CLAIMS.ic3Y : V4_CLAIMS.ic1Y;
  const hitRate = is3Y ? V4_CLAIMS.yearHitRate3Y : V4_CLAIMS.yearHitRate1Y;
  const dollarGap = is3Y ? V4_CLAIMS.metroGap3Y : V4_CLAIMS.metroGap1Y;

  const stats = [
    {
      icon: TrendingUp,
      value: correlation.toFixed(2),
      label: `OOS Correlation (${horizonLabel})`,
      sublabel: "PropertyIQ Score, walk-forward validated",
    },
    {
      icon: DollarSign,
      value: `$${dollarGap.toLocaleString("en-US")}`,
      label: `Top vs bottom quintile (${horizonLabel})`,
      sublabel: `Dollar difference on $${Math.round(V4_CLAIMS.medianHomeValue / 1000)}K home`,
    },
    {
      icon: Calendar,
      value: String(V4_CLAIMS.backtestYears),
      label: "Years of backtest data",
      sublabel: "Walk-forward validated (2012\u20132024)",
    },
    {
      icon: CheckCircle,
      value: `${hitRate}%`,
      label: `Hit rate (${horizonLabel})`,
      sublabel: "Top-scored markets beating benchmark",
    },
    {
      icon: MapPin,
      value: V4_CLAIMS.metrosValidated.toLocaleString("en-US"),
      label: "Metros validated",
      sublabel: `${V4_CLAIMS.countiesValidated.toLocaleString("en-US")} counties \u00B7 ${V4_CLAIMS.zipsValidated.toLocaleString("en-US")} ZIPs`,
    },
  ];

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Forecast Accuracy
      </p>
      <h1 className="text-3xl md:text-4xl font-[var(--font-source-serif)] text-on-surface mt-2">
        {correlation.toFixed(2)} OOS Correlation. {V4_CLAIMS.backtestYears}{" "}
        Years. <span className="text-primary">Real Data.</span>
      </h1>
      <p className="text-on-surface-variant mt-3 max-w-3xl text-base leading-relaxed">
        PropertyIQ validates with walk-forward cross-validation across{" "}
        {V4_CLAIMS.backtestYears} years of data. Every number on this page comes
        from held-out test periods the model never trained on.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
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
      </div>
    </section>
  );
}
