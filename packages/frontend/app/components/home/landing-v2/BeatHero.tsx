import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";
import type { HeroContrast, HeroMarket } from "@/lib/data";
import { PrimaryCta } from "./PrimaryCta";
import { OutlookNarrative } from "./OutlookNarrative";

/**
 * Beat 1 — the verdict, first.
 *
 * The LCP element: server-rendered (ISR-cached), static markup, no load
 * animation. A balanced two-column hero — the claim + CTA on the left, two
 * real-market "proof" cards on the right.
 *
 * FRAMING: the PropertyIQ Score is PREDICTIVE — it forecasts how a market will
 * perform against its own state over the coming years (validated by backtest),
 * NOT today's temperature. The two cards contrast a famous market the Score
 * flags to lag vs. a market it flags to lead. Copy must stay future-tense.
 *
 * NARRATIVE: `cooler.narrative` / `riser.narrative` are real AI-written ad copy
 * (DeepSeek, generated server-side and cached per market+score-date — never per
 * visitor). The functions below are the deterministic fallback used when the AI
 * copy is absent, and they stay future-framed too.
 */

function fallbackCoolerNarrative(m: HeroMarket): string {
  const signal =
    m.priceCutPct != null && m.priceCutPct > 0
      ? `${m.priceCutPct}% of sellers are already cutting price`
      : `its demand momentum is fading`;
  return `At ${m.score}, the Score flags ${m.name} to grow slower than its state in the years ahead — ${signal}, the kind of early signal that has led price growth lower before the headlines noticed.`;
}

function fallbackRiserNarrative(m: HeroMarket): string {
  const signal =
    m.valueYoyPct != null && m.valueYoyPct > 0 && m.dom != null
      ? `values are up ${m.valueYoyPct}% and homes clear in ${m.dom} days`
      : m.dom != null
        ? `homes clear in just ${m.dom} days`
        : `demand is the strongest in the country`;
  return `At ${m.score}, ${m.name} carries one of the strongest demand signals in the country — historically the setup for years of above-state appreciation. Today ${signal}, and almost no one is watching.`;
}

function ContrastCard({
  market,
  role,
}: {
  market: HeroMarket;
  role: "cooler" | "riser";
}) {
  const kicker = role === "cooler" ? "Flagged to lag" : "Flagged to lead";
  const kickerColor = role === "cooler" ? "text-red-700" : "text-green-700";
  const narrative =
    market.narrative ??
    (role === "cooler"
      ? fallbackCoolerNarrative(market)
      : fallbackRiserNarrative(market));
  return (
    <div className="flex items-start gap-4 rounded-xl bg-surface p-5 shadow-sm">
      <ScoreDisplay
        value={market.score}
        size={92}
        strokeWidth={8}
        showGrade={false}
        showLabel={false}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${kickerColor}`}
        >
          {kicker}
        </p>
        <p className="text-lg font-semibold text-on-surface">{market.name}</p>
        <OutlookNarrative
          cbsa={market.cbsa}
          fallback={narrative}
          className="mt-1.5 text-sm leading-snug text-on-surface-variant"
        />
      </div>
    </div>
  );
}

function HeroCopy({ contrast }: { contrast: HeroContrast | null }) {
  return (
    <div>
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary-light">
        The verdict, first
      </p>
      {contrast ? (
        <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          {contrast.cooler.name} scores{" "}
          <span className="font-mono">{contrast.cooler.score}</span>.
          <br />
          {contrast.riser.name} scores{" "}
          <span className="font-mono">{contrast.riser.score}</span>.
        </h1>
      ) : (
        <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Every U.S. market, scored on one honest number.
        </h1>
      )}

      <p className="mt-6 max-w-xl text-lg text-primary-light">
        Two markets, opposite futures. The PropertyIQ Score distills momentum,
        days on market, and price cuts into one 1&ndash;99 number that predicts
        how a market will perform against its state &mdash; so you buy where the
        data is headed, not where the hype is.
      </p>

      <div className="mt-8">
        <PrimaryCta source="hero" tone="onDark" />
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
  );
}

export function BeatHero({ contrast }: { contrast: HeroContrast | null }) {
  return (
    <section
      id="beat-hero"
      className="px-5 pb-16 pt-24 text-on-primary md:pb-24 md:pt-32"
    >
      <div className="mx-auto w-full max-w-6xl">
        {contrast ? (
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <HeroCopy contrast={contrast} />
            <div className="flex flex-col gap-3">
              <ContrastCard market={contrast.cooler} role="cooler" />
              <p
                className="self-center font-serif text-lg text-primary-light"
                aria-hidden
              >
                vs
              </p>
              <ContrastCard market={contrast.riser} role="riser" />
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <HeroCopy contrast={null} />
          </div>
        )}
      </div>
    </section>
  );
}
