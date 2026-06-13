"use client";

/**
 * Hero Stats Section
 *
 * Five stat cards showing key PropertyIQ validation metrics.
 * The PropertyIQ Score targets a 3-year horizon, so all labels read "(3Y)".
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

export function HeroStats() {
  const correlation = V4_CLAIMS.ic3Y;
  const hitRate = V4_CLAIMS.yearHitRate3Y;
  const dollarGap = V4_CLAIMS.scoreExtreme3YGap;

  const stats = [
    {
      icon: TrendingUp,
      value: correlation.toFixed(2),
      label: "OOS Correlation (3Y)",
      sublabel: "PropertyIQ Score, walk-forward validated",
    },
    {
      icon: DollarSign,
      value: `$${dollarGap.toLocaleString("en-US")}`,
      label: "Score 100 vs Score 10 (3Y)",
      sublabel: `Dollar difference on $${Math.round(V4_CLAIMS.medianHomeValue / 1000)}K home`,
    },
    {
      icon: Calendar,
      value: String(V4_CLAIMS.backtestYears),
      label: "Years of backtest data",
      sublabel: "Out-of-sample, 2001\u20132023",
    },
    {
      icon: CheckCircle,
      value: `${hitRate}%`,
      label: "Hit rate (3Y)",
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
        PropertyIQ validates out-of-sample across {V4_CLAIMS.backtestYears}{" "}
        years of data. Every number on this page comes by measuring each score
        against returns from after the score date.
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
