/**
 * Hero Stats Section
 *
 * Five stat cards showing key v3 walk-forward validation metrics.
 * Static server component — all numbers are hardcoded from the v3 validation report.
 */

import {
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  MapPin,
} from "lucide-react";

const stats = [
  {
    icon: TrendingUp,
    value: "0.37",
    label: "OOS Information Coefficient",
    sublabel: "Metro InvestorEdge, walk-forward validated",
  },
  {
    icon: DollarSign,
    value: "$13,320",
    label: "Top vs bottom quintile spread",
    sublabel: "Annual dollar difference on $240K home",
  },
  {
    icon: Calendar,
    value: "4",
    label: "Walk-forward windows",
    sublabel: "Non-overlapping test periods (2018\u20132023)",
  },
  {
    icon: CheckCircle,
    value: "69.5%",
    label: "Hit rate",
    sublabel: "Top-scored markets beating benchmark",
  },
  {
    icon: MapPin,
    value: "23,329",
    label: "Locations scored",
    sublabel: "924 metros \u00B7 2,482 counties \u00B7 19,923 ZIPs",
  },
];

export function HeroStats() {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Forecast Accuracy
      </p>
      <h1 className="text-3xl md:text-4xl font-[var(--font-source-serif)] text-on-surface mt-2">
        0.37 OOS Correlation. 4 Windows.{" "}
        <span className="text-primary">Real Data.</span>
      </h1>
      <p className="text-on-surface-variant mt-3 max-w-3xl text-base leading-relaxed">
        PropertyIQ validates with walk-forward cross-validation across 6 years
        of data. Every number on this page comes from held-out test periods the
        model never trained on.
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
