import type { Metadata } from "next";
import { ArrowRight, BarChart3, TrendingUp, Percent } from "lucide-react";
import Link from "next/link";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";
import { ScoresFaqJsonLd, ScoresFaqSection } from "./ScoresFaqSection";
import {
  HowToUseScoresSection,
  MethodologyOverviewSection,
} from "./ScoresContentSections";
import { METRO_DECILE_1Y, METRO_DECILE_3Y } from "./decile-data";
import type { DecileRow } from "./decile-data";

export const metadata: Metadata = {
  title: "PropertyIQ Score — Predict Real Estate Market Performance",
  description:
    "One number that predicts market performance. Validated across 746 metros and 13 years of data with 100% year hit rate. See the methodology and proof.",
  alternates: { canonical: "https://www.propertyiq.app/scores" },
  openGraph: {
    title: "PropertyIQ Score — Predict Real Estate Market Performance",
    description:
      "One number that predicts real estate market performance. Validated across 746 metros with 100% year hit rate.",
    url: "https://www.propertyiq.app/scores",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

const STAT_PILLS = [
  { label: "746 metros", icon: BarChart3 },
  { label: "13 years", icon: TrendingUp },
  { label: "100% year hit rate", icon: Percent },
];

const HOW_IT_WORKS_STEPS = [
  {
    number: 1,
    title: "3 Housing Metrics",
    description:
      "% Sold Above List, Median Days on Market, Months of Supply — the three signals that actually predict future returns.",
  },
  {
    number: 2,
    title: "Z-Score Normalization",
    description:
      "Each metric is standardized against the national distribution, removing scale differences so they combine cleanly.",
  },
  {
    number: 3,
    title: "Percentile Score",
    description:
      "The composite z-score is mapped to 1-99 where 50 equals the state average. Higher is better.",
  },
];

function DecileTable({
  title,
  data,
  horizon,
}: {
  title: string;
  data: DecileRow[];
  horizon: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant">
        <h3 className="text-lg font-medium text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-1">
          {horizon} excess return vs. state benchmark
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-4 py-3 text-left font-medium text-on-surface-variant">
                Score
              </th>
              <th className="px-4 py-3 text-right font-medium text-on-surface-variant">
                Mean Excess
              </th>
              <th className="px-4 py-3 text-right font-medium text-on-surface-variant">
                P(Beat State)
              </th>
              <th className="px-4 py-3 text-right font-medium text-on-surface-variant">
                N
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isHighlight = row.score >= 80;
              const isMidpoint = row.score === 50;
              const rowClasses = isHighlight
                ? "bg-primary/5"
                : isMidpoint
                  ? "bg-surface-container"
                  : "";
              return (
                <tr
                  key={row.score}
                  className={`border-b border-outline-variant/50 ${rowClasses}`}
                >
                  <td className="px-4 py-2.5 font-[family-name:var(--font-roboto-mono)] font-medium text-on-surface">
                    {row.score}
                    {isMidpoint && (
                      <span className="ml-2 text-xs text-on-surface-variant">
                        state avg
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-[family-name:var(--font-roboto-mono)] ${
                      row.meanExcess >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {row.meanExcess >= 0 ? "+" : ""}
                    {row.meanExcess.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.pBeatState.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface-variant">
                    {row.n.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScoresPage() {
  return (
    <>
      <WebPageJsonLd
        url="https://www.propertyiq.app/scores"
        name="The PropertyIQ Score"
        description="One number that predicts market performance. Validated, not vibes."
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Scores", url: "https://www.propertyiq.app/scores" },
        ]}
      />
      <ScoresFaqJsonLd />
      <div className="mt-12 space-y-16">
        {/* Section 1: Hero */}
        <section className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            Validated, Not Vibes
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-on-surface mt-4 tracking-tight">
            The PropertyIQ Score
          </h1>
          <p className="text-lg md:text-xl text-on-surface-variant mt-4 max-w-2xl mx-auto">
            One number that predicts market performance. Validated, not vibes.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {STAT_PILLS.map((pill) => {
              const Icon = pill.icon;
              return (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium"
                >
                  <Icon className="w-4 h-4" />
                  {pill.label}
                </span>
              );
            })}
          </div>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors mt-8"
          >
            Explore scored markets <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Section 2: Decile Performance Tables */}
        <section>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            The Proof
          </p>
          <h2 className="text-2xl md:text-3xl font-[var(--font-source-serif)] text-on-surface mt-2">
            Decile Performance
          </h2>
          <p className="text-on-surface-variant mt-3 max-w-3xl">
            Higher-scored metros consistently outperform their state benchmark.
            The pattern holds across both 1-year and 3-year horizons, with
            monotonic separation between deciles.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <DecileTable
              title="1-Year Returns"
              data={METRO_DECILE_1Y}
              horizon="1-year"
            />
            <DecileTable
              title="3-Year Returns"
              data={METRO_DECILE_3Y}
              horizon="3-year cumulative"
            />
          </div>
        </section>

        {/* Section 3: How It Works */}
        <section>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            Methodology
          </p>
          <h2 className="text-2xl md:text-3xl font-[var(--font-source-serif)] text-on-surface mt-2">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.number}
                className="bg-surface-container-low rounded-xl shadow-sm p-6"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold">
                  {step.number}
                </span>
                <h3 className="text-lg font-semibold text-on-surface mt-3">
                  {step.title}
                </h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Dollar Impact */}
        <section className="bg-surface-container-low rounded-xl shadow-sm p-8 md:p-12">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            Why It Matters
          </p>
          <p className="text-4xl md:text-5xl font-bold text-on-surface mt-4 font-[family-name:var(--font-roboto-mono)]">
            $24,384
          </p>
          <p className="text-lg text-on-surface-variant mt-2">
            The cost of choosing wrong
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="border border-outline-variant rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-medium text-on-surface">Score 80+</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Top-quintile metros averaged{" "}
                <span className="font-[family-name:var(--font-roboto-mono)] font-medium text-green-600">
                  +0.53%
                </span>{" "}
                excess return per year over their state benchmark. On a typical
                $300K home, that compounds to meaningful wealth over 3 years.
              </p>
            </div>
            <div className="border border-outline-variant rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium text-on-surface">Score 20</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Bottom-quintile metros averaged{" "}
                <span className="font-[family-name:var(--font-roboto-mono)] font-medium text-red-600">
                  -1.26%
                </span>{" "}
                excess return per year versus their state. At the extremes,
                choosing a score-10 over a score-100 market costs roughly
                $24,384 in lost equity over 3 years.
              </p>
            </div>
          </div>
        </section>

        <HowToUseScoresSection />
        <MethodologyOverviewSection />
        <ScoresFaqSection />

        {/* Section 6: CTA Footer */}
        <section className="border-t border-outline-variant pt-8 mt-8 text-center">
          <h3 className="text-xl font-semibold text-on-surface">
            Ready to find the best markets?
          </h3>
          <p className="text-on-surface-variant mt-2">
            Use the PropertyIQ Score to discover high-performing markets backed
            by data, not hunches.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
            >
              Explore the Map <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary rounded-full font-medium hover:bg-primary/10 transition-colors"
            >
              Generate a Report <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
