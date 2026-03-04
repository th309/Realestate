/**
 * Dollar Impact Section
 *
 * Shows real-world financial impact of score-driven investing.
 * Server component — static marketing content.
 */

import { Home, Building2, ShieldAlert } from "lucide-react";

const IMPACTS = [
  {
    icon: Home,
    iconClass: "bg-primary/10 text-primary",
    title: "Single Home",
    value: "+$13,320/yr",
    description:
      "Top-quintile scored markets (Q5) earned $13,320 more in annual appreciation than bottom-quintile markets (Q1) on a $240K home.",
  },
  {
    icon: Building2,
    iconClass: "bg-secondary/10 text-secondary",
    title: "3-Property Portfolio",
    value: "+$39,960/yr",
    description:
      "A 3-property portfolio in top-scored markets generates nearly $40K more per year in equity versus bottom-scored markets.",
  },
  {
    icon: ShieldAlert,
    iconClass: "bg-error/10 text-error",
    title: "Avoid Losses",
    value: "Negative Returns",
    description:
      "Bottom-quintile markets delivered negative excess returns while top-quintile markets thrived. Our scores flagged the underperformers.",
  },
];

export function DollarImpactSection() {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Real-World Impact
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        Score-Driven Investing: The Dollar Difference
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        PropertyIQ Scores don&apos;t just rank markets &mdash; they predict real
        dollar outcomes. Here&apos;s what the data shows.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {IMPACTS.map((impact) => {
          const Icon = impact.icon;
          return (
            <div
              key={impact.title}
              className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant"
            >
              <div className={`${impact.iconClass} p-2 rounded-xl w-fit`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-on-surface-variant mt-3 uppercase tracking-wider font-medium">
                {impact.title}
              </p>
              <p className="text-2xl font-bold text-on-surface mt-1">
                {impact.value}
              </p>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                {impact.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
