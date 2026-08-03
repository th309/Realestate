import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";
import { Section, HEADING } from "@/app/components/marketing";
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
 * Deliberately carries no product screenshot: every asset in
 * public/images/home/ predates the single-PropertyIQ-Score migration and shows
 * retired score names (InvestorEdge / HomeReady / Market Health) or an outright
 * banned quality label, so none may sit above the fold (CLAUDE.md section 9).
 *
 * The band is a pale wash from the shared hero tokens rather than the dark top
 * of a page-wide indigo gradient, so every colour here is a light-band token —
 * `text-primary-light` and `text-on-primary` would be invisible against it.
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
  const kicker = role === "cooler" ? "Flagged to lag" : "Strongest outlook";
  const kickerColor = role === "cooler" ? "text-error" : "text-tertiary";
  const narrative =
    market.narrative ??
    (role === "cooler"
      ? fallbackCoolerNarrative(market)
      : fallbackRiserNarrative(market));
  return (
    <div className="flex items-start gap-4 rounded-xl border border-outline-variant bg-surface p-5 shadow-sm">
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
    <div className="flex flex-col items-start gap-6">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
        The forecast, first
      </p>
      {contrast ? (
        <h1 className={`${HEADING.hero} text-balance text-on-surface`}>
          {contrast.cooler.name} scores{" "}
          <span className="font-mono tabular-nums">
            {contrast.cooler.score}
          </span>
          .
          <br />
          {contrast.riser.name} scores{" "}
          <span className="font-mono tabular-nums">{contrast.riser.score}</span>
          .
        </h1>
      ) : (
        <h1 className={`${HEADING.hero} text-balance text-on-surface`}>
          Every U.S. market, scored on one honest number.
        </h1>
      )}

      <p className="max-w-xl text-lg text-on-surface-variant">
        Two markets, opposite futures. The PropertyIQ Score is a momentum
        forecast, not a quality grade &mdash; it distills price momentum, days
        on market, and price cuts into one{" "}
        <span className="font-mono tabular-nums">1&ndash;99</span> number that
        predicts how a market will perform against its state, so you buy where
        the data is headed, not where the hype is.
      </p>

      <div>
        <PrimaryCta source="hero" tone="onLight" />
        <a
          href="#beat-score"
          className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          See how the Score works →
        </a>
      </div>

      {contrast?.asOf && (
        <p className="text-xs text-on-surface-variant">
          PropertyIQ Scores as of {contrast.asOf}. Updated monthly.
        </p>
      )}
    </div>
  );
}

export function BeatHero({
  contrast = null,
}: {
  contrast?: HeroContrast | null;
}) {
  return (
    <div className="bg-gradient-to-b from-hero-from to-hero-to">
      <Section id="beat-hero" rhythm="tight">
        {contrast ? (
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <HeroCopy contrast={contrast} />
            <div className="flex flex-col gap-3">
              <ContrastCard market={contrast.cooler} role="cooler" />
              <p
                className="self-center font-serif text-lg text-on-surface-variant"
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
      </Section>
    </div>
  );
}
