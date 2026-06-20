import { TrendingDown, TrendingUp } from "lucide-react";
import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";
import type { HeroContrast, HeroMarket } from "@/lib/data";
import { PrimaryCta } from "./PrimaryCta";

/**
 * Beat 1 — the verdict, first.
 *
 * The LCP element: server-rendered (ISR-cached), static markup, no load
 * animation. Leads with the live momentum contrast — the recognizable market
 * cooling fastest vs. the one heating up fastest — as the headline, with each
 * score in a light card (the ScoreDisplay ring's number is dark, so it needs a
 * light surface on the dark indigo top of the gradient — spec §4.0). Falls back
 * to a static headline with no rings if live data is briefly unavailable, so the
 * hero never blocks on the network.
 */

function DeltaChip({ market }: { market: HeroMarket }) {
  const down = market.direction === "down";
  const Icon = down ? TrendingDown : TrendingUp;
  const tone = down ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {Math.abs(market.delta)} pts · 3&nbsp;mo
    </span>
  );
}

function ContrastCard({
  market,
  kicker,
}: {
  market: HeroMarket;
  kicker: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 rounded-xl bg-surface p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        {kicker}
      </p>
      <ScoreDisplay
        value={market.score}
        size={132}
        strokeWidth={9}
        showGrade={false}
        showLabel
      />
      <p className="font-medium text-on-surface">{market.name}</p>
      <DeltaChip market={market} />
    </div>
  );
}

export function BeatHero({ contrast }: { contrast: HeroContrast | null }) {
  return (
    <section
      id="beat-hero"
      className="px-5 pb-16 pt-24 text-on-primary md:pb-24 md:pt-32"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary-light">
          The verdict, first
        </p>

        {contrast ? (
          <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            {contrast.cooler.name} scores{" "}
            <span className="font-mono">{contrast.cooler.score}</span>.
            <br />
            {contrast.riser.name} scores{" "}
            <span className="font-mono">{contrast.riser.score}</span>.
          </h1>
        ) : (
          <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Every U.S. market, scored on one honest number.
          </h1>
        )}

        <p className="mt-6 max-w-2xl text-lg text-primary-light md:text-xl">
          The market everyone&apos;s chasing versus the one nobody&apos;s
          talking about. The PropertyIQ Score reads momentum, days on market,
          and price cuts into a single 1&ndash;99 number &mdash; so you see
          which markets are actually moving before you commit.
        </p>

        {contrast && (
          <div className="mt-10 flex max-w-2xl flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-6">
            <ContrastCard market={contrast.cooler} kicker="Cooling fast" />
            <span
              className="self-center font-serif text-2xl text-primary-light"
              aria-hidden
            >
              vs
            </span>
            <ContrastCard market={contrast.riser} kicker="Heating up" />
          </div>
        )}

        <div className="mt-10">
          <PrimaryCta source="hero" />
          <a
            href="#beat-score"
            className="mt-5 inline-block text-sm font-medium text-primary-light underline-offset-4 hover:underline"
          >
            See how the Score works →
          </a>
        </div>

        {contrast?.asOf && (
          <p className="mt-6 text-xs text-primary-light/70">
            PropertyIQ Scores as of {contrast.asOf}. Updated monthly.
          </p>
        )}
      </div>
    </section>
  );
}
