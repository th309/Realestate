import { CONTAINER, HEADING, SURFACE } from "@/app/components/marketing";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import type { HeroContrast } from "@/lib/data";
import { PrimaryCta } from "./PrimaryCta";
import { HeroMonitor } from "./HeroMonitor";
import { HeroCapabilities } from "./HeroCapabilities";
import { Constellation } from "./Constellation";

/**
 * The homepage hero.
 *
 * Built from the approved mockup: a 42/58 split with the claim on the left and
 * the product on the right, over the pale hero wash, closed by a full-width
 * proof strip. The right column is a drawn monitor rather than a screenshot —
 * see HeroMonitor for why.
 *
 * The LCP element is the H1, server-rendered from ISR-cached data with no load
 * animation. `contrast` is null-safe: if the score batch is briefly unavailable
 * the hero drops to the static headline and the monitor is omitted rather than
 * rendering placeholder numbers.
 *
 * FRAMING (CLAUDE.md section 9): the Score is a momentum forecast measured
 * against the market's own state average, not a quality grade. Copy here stays
 * future-tense and never uses a quality word.
 */

function HeroCopy({ contrast }: { contrast: HeroContrast | null }) {
  return (
    <div>
      <span className="inline-flex items-center gap-2.5 rounded-full border border-outline-variant bg-surface px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.13em] text-primary">
        <span className="size-[7px] rounded-full bg-tertiary" />
        Forward-looking market scores
      </span>

      <h1 className={`${HEADING.hero} my-6 text-balance text-on-surface`}>
        Know where a market is headed{" "}
        <span className="bg-gradient-to-r from-tertiary to-primary bg-clip-text text-transparent">
          before you buy.
        </span>
      </h1>

      <p className="max-w-[33em] text-[17px] leading-[1.62] text-on-surface-variant">
        {contrast ? (
          <>
            {contrast.cooler.name} scores{" "}
            <span className="font-mono tabular-nums">
              {contrast.cooler.score}
            </span>
            . {contrast.riser.name} scores{" "}
            <span className="font-mono tabular-nums">
              {contrast.riser.score}
            </span>
            .{" "}
          </>
        ) : null}
        PropertyIQ distills price momentum, days on market, and price cuts into
        one number per metro, county, and ZIP — updated monthly, and calibrated
        so <span className="font-mono tabular-nums">50</span> is that
        market&rsquo;s own state average.
      </p>

      <p className="mt-3.5 text-[15px] italic text-tertiary-text">
        Built on twenty-five years of data, not vibes.
      </p>

      <PrimaryCta source="hero" tone="onLight" className="mt-7" />

      <p className="mt-4 text-[13.5px] text-on-surface-variant">
        <strong className="font-semibold text-on-surface">
          {COVERAGE_COPY.metros} metros, {COVERAGE_COPY.counties} counties,{" "}
          {COVERAGE_COPY.zips} ZIPs.
        </strong>{" "}
        Scored monthly, with history back to 2001.
      </p>

      <p className="mt-3.5 text-[15px] italic text-tertiary-text">
        Everyone else is still guessing off median list price.
      </p>

      {contrast?.asOf ? (
        <p className="mt-4 text-xs text-on-surface-variant">
          PropertyIQ Scores as of {contrast.asOf}. Updated monthly.
        </p>
      ) : null}
    </div>
  );
}

export function BeatHero({
  contrast = null,
}: {
  contrast?: HeroContrast | null;
}) {
  // Four leaders plus the cooler, so the strip shows the spread rather than a
  // wall of green — the contrast is the whole argument of the hero. Both the
  // featured market and the cooler are excluded from the slice: the featured
  // one is already the headline above, and the cooler is pinned to the bottom.
  const leaderboard = contrast
    ? [
        ...contrast.ranked
          .filter(
            (m) =>
              m.cbsa !== contrast.cooler.cbsa && m.cbsa !== contrast.riser.cbsa,
          )
          .slice(0, 4),
        contrast.cooler,
      ]
    : [];

  return (
    // Not `Section`: the proof strip is full-bleed and sits outside the
    // container, and the hero takes a tighter rhythm than any other band. The
    // wash still comes from the shared surface token.
    <section
      id="beat-hero"
      className={`relative overflow-hidden ${SURFACE.hero}`}
    >
      <Constellation />
      <div className={`relative ${CONTAINER} pb-10 pt-14`}>
        <div className="grid items-center gap-12 lg:grid-cols-[42fr_58fr] lg:gap-14">
          <HeroCopy contrast={contrast} />
          {contrast ? (
            <div className="flex flex-col items-center">
              <HeroMonitor market={contrast.riser} leaderboard={leaderboard} />
              <HeroCapabilities />
            </div>
          ) : (
            <HeroCapabilities />
          )}
        </div>
      </div>

      <p className="border-t border-outline-variant bg-surface py-5 text-center text-[14.5px] text-on-surface-variant">
        Used by{" "}
        <strong className="font-semibold text-on-surface">
          investors, agents, and syndicators
        </strong>{" "}
        who&rsquo;d rather not learn a market the expensive way
      </p>
    </section>
  );
}
