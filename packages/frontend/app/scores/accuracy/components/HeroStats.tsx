/**
 * Hero Stats Section
 *
 * Five stat cards showing key validation metrics fetched from the live API.
 * Client component — data comes from useValidationSummary and useValidationGeography.
 */

"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  MapPin,
} from "lucide-react";
import {
  useValidationSummary,
  useValidationQuintiles,
  useValidationTimeSeries,
  useValidationGeography,
} from "@/lib/data";

function StatSkeleton() {
  return (
    <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant">
      <div className="p-2 bg-outline-variant/20 rounded-xl w-8 h-8 animate-pulse" />
      <div className="h-7 w-16 bg-outline-variant/30 rounded mt-3 animate-pulse" />
      <div className="h-3 w-32 bg-outline-variant/20 rounded mt-2 animate-pulse" />
    </div>
  );
}

export function HeroStats() {
  const { data: summary, isLoading: summaryLoading } = useValidationSummary({
    geography: "metro",
    scoreType: "homeready",
  });

  const { data: quintiles } = useValidationQuintiles({
    geography: "metro",
    scoreType: "homeready",
    horizon: "1y",
  });

  const { data: timeSeries } = useValidationTimeSeries({
    geography: "metro",
    scoreType: "homeready",
  });

  const { data: geoData } = useValidationGeography({
    scoreType: "homeready",
  });

  const stats = useMemo(() => {
    const MEDIAN_HOME = 240_000;

    // Correlation from summary
    const correlation = summary?.correlation1y;
    const correlationStr = correlation != null ? correlation.toFixed(2) : "--";

    // Dollar impact from quintile spread
    let dollarImpact = "--";
    if (quintiles && quintiles.length >= 2) {
      const topQ = quintiles.find((q) => q.quintile === 5);
      const bottomQ = quintiles.find((q) => q.quintile === 1);
      if (
        topQ?.avgExcessVsState1y != null &&
        bottomQ?.avgExcessVsState1y != null
      ) {
        const spreadPct = topQ.avgExcessVsState1y - bottomQ.avgExcessVsState1y;
        const dollars = Math.round((spreadPct / 100) * MEDIAN_HOME);
        dollarImpact = `$${Math.abs(dollars).toLocaleString()}`;
      }
    }

    // Validation windows from time series count
    const windowCount = timeSeries?.length ?? 0;
    const windowStr = windowCount > 0 ? String(windowCount) : "--";

    // Total markets from geography breakdown
    let totalMarkets = 0;
    if (geoData) {
      totalMarkets = geoData.reduce((sum, g) => sum + g.totalScores, 0);
    }
    const marketsStr =
      totalMarkets > 0 ? `${totalMarkets.toLocaleString()}+` : "--";

    // Hit rate from summary
    const hitRate = summary?.hitRate1y;
    const hitRateStr = hitRate != null ? `${Math.round(hitRate)}%` : "--";

    return [
      {
        icon: TrendingUp,
        value: correlationStr,
        label: "Rank correlation (Spearman \u03C1)",
        sublabel: "Score vs 1-year excess return",
      },
      {
        icon: DollarSign,
        value: dollarImpact,
        label: "Top vs bottom quintile spread",
        sublabel: "Annual dollar difference on $240K home",
      },
      {
        icon: Calendar,
        value: windowStr,
        label: `Validation window${windowCount !== 1 ? "s" : ""}`,
        sublabel: "Monthly walk-forward periods tested",
      },
      {
        icon: CheckCircle,
        value: hitRateStr,
        label: "Hit rate",
        sublabel: "High-scored markets beating benchmark",
      },
      {
        icon: MapPin,
        value: marketsStr,
        label: "Markets scored and tracked",
        sublabel: "Metros, counties, and ZIP codes",
      },
    ];
  }, [summary, quintiles, timeSeries, geoData]);

  const isLoading = summaryLoading;

  // Build headline from live data
  const correlation = summary?.correlation1y;
  const windowCount = timeSeries?.length ?? 0;
  const correlationLabel = correlation != null ? correlation.toFixed(2) : "...";
  const windowLabel = windowCount > 0 ? String(windowCount) : "...";

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Forecast Accuracy
      </p>
      <h1 className="text-3xl md:text-4xl font-[var(--font-source-serif)] text-on-surface mt-2">
        {correlationLabel} Correlation. {windowLabel} Months.{" "}
        <span className="text-primary">Real Data.</span>
      </h1>
      <p className="text-on-surface-variant mt-3 max-w-3xl text-base leading-relaxed">
        PropertyIQ validates across multiple consecutive months and thousands of
        markets. Every number on this page comes from our live validation
        pipeline.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((stat) => {
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
                  {stat.sublabel && (
                    <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                      {stat.sublabel}
                    </p>
                  )}
                </div>
              );
            })}
      </div>
    </section>
  );
}
