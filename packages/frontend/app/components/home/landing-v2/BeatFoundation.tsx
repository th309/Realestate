import { AnimatedCounter } from "@/app/components/home/AnimatedCounter";
import { BeatSection } from "./BeatSection";
import { Reveal } from "./Reveal";

/**
 * Beat 3 — "The Foundation" (scale = credibility).
 *
 * One point, stated plainly: PropertyIQ covers every U.S. market, built from
 * five real data sources. Four count-up stats (mono numbers via AnimatedCounter)
 * anchor the claim, followed by a quiet source-attribution line. Sits in the
 * upper-middle of the page's fixed indigo→light gradient, so it's still
 * light-on-dark — tone="dark" (spec §4.0).
 *
 * No 'use client' here: AnimatedCounter is itself a client component and can be
 * rendered from this server component. The count-ups only fire on scroll-into-
 * view (AnimatedCounter's own IntersectionObserver), and this beat is below the
 * fold, so they animate as the user reaches them.
 *
 * Stat note: the "history since" stat is a calendar year (2001), so it is
 * rendered as a static mono number rather than via AnimatedCounter —
 * AnimatedCounter formats with toLocaleString(), which would render "2,001".
 */

interface FoundationStat {
  /** Numeric target for the count-up (omitted for the static year stat). */
  end?: number;
  /** Pre-formatted display string for stats that don't count up (the year). */
  staticValue?: string;
  suffix?: string;
  label: string;
}

const FOUNDATION_STATS: FoundationStat[] = [
  { end: 935, label: "metros" },
  { end: 3150, label: "counties" },
  { end: 34000, label: "ZIP codes" },
  { staticValue: "2001", label: "history since" },
];

const SOURCES = ["Zillow", "Realtor.com", "Census", "FRED", "BLS"];

function FoundationStatBlock({ stat }: { stat: FoundationStat }) {
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <div className="font-mono text-4xl font-semibold tracking-tight text-on-primary sm:text-5xl md:text-6xl">
        {stat.staticValue !== undefined ? (
          stat.staticValue
        ) : (
          <AnimatedCounter end={stat.end ?? 0} suffix={stat.suffix} />
        )}
      </div>
      <p className="mt-2 text-sm font-medium uppercase tracking-wide text-primary-light">
        {stat.label}
      </p>
    </div>
  );
}

export function BeatFoundation() {
  return (
    <BeatSection id="beat-foundation" eyebrow="The foundation" tone="dark">
      <Reveal>
        <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
          Every market. Five sources. One number.
        </h2>
      </Reveal>

      <Reveal delayMs={70}>
        <p className="mt-5 max-w-2xl text-lg text-primary-light">
          We score the entire country &mdash; from the biggest metros down to
          individual ZIP codes &mdash; and we&apos;ve been tracking it for over
          two decades.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:mt-16 md:grid-cols-4">
        {FOUNDATION_STATS.map((stat, index) => (
          <Reveal key={stat.label} delayMs={140 + index * 70}>
            <FoundationStatBlock stat={stat} />
          </Reveal>
        ))}
      </div>

      <Reveal delayMs={140 + FOUNDATION_STATS.length * 70} className="mt-14">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-light">
          <span className="font-medium text-on-primary">Built on</span>
          {SOURCES.map((source, index) => (
            <span key={source} className="inline-flex items-center gap-2">
              {index > 0 && (
                <span className="text-primary-light/50" aria-hidden>
                  &middot;
                </span>
              )}
              {source}
            </span>
          ))}
        </p>
      </Reveal>
    </BeatSection>
  );
}
