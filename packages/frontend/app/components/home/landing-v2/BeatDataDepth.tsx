import { BeatSection } from "./BeatSection";
import { Reveal } from "./Reveal";

/**
 * Supporting beat — "The Data" (depth + freshness).
 *
 * A brief, quiet beat sitting between the proof and the close, on the light
 * lower half of the page's fixed indigo→light gradient, so it reads
 * dark-on-light via BeatSection's tone="light" (spec §4.0). It makes one
 * understated point — the data is both deep (two decades of history) and fresh
 * (refreshed monthly) — without the visual weight of a headline beat: a smaller
 * serif headline, two short supporting lines, mono numbers, and no CTA.
 *
 * Server-rendered; the only client behavior is the staggered scroll fade from
 * the already-client Reveal primitive.
 */

const COVERAGE_STATS: { value: string; label: string }[] = [
  { value: "935", label: "metros" },
  { value: "3,150", label: "counties" },
  { value: "34,000", label: "ZIP codes" },
];

const SOURCES = ["Zillow", "Realtor.com", "Census", "FRED", "BLS"];

export function BeatDataDepth() {
  return (
    <BeatSection id="beat-data-depth" eyebrow="The data" tone="light">
      <Reveal>
        <h2 className="max-w-2xl font-serif text-2xl font-semibold leading-tight tracking-tight text-on-surface sm:text-3xl">
          Two decades of history. Refreshed every month.
        </h2>
      </Reveal>

      <Reveal delayMs={70} className="mt-5">
        <p className="max-w-2xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
          History backfilled to{" "}
          <span className="font-mono font-medium text-on-surface">2001</span>,
          so every market is read against where it has actually been.
        </p>
      </Reveal>

      <Reveal delayMs={140} className="mt-3">
        <p className="max-w-2xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
          <span className="font-mono font-medium text-on-surface">~935</span>{" "}
          metros,{" "}
          <span className="font-mono font-medium text-on-surface">3,150</span>{" "}
          counties, and{" "}
          <span className="font-mono font-medium text-on-surface">34,000</span>{" "}
          ZIPs scored every month from {SOURCES.join(", ")}.
        </p>
      </Reveal>

      <Reveal
        delayMs={210}
        className="mt-8 flex flex-wrap gap-x-8 gap-y-3 sm:mt-10"
      >
        {COVERAGE_STATS.map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
              {stat.value}
            </span>
            <span className="text-sm font-medium uppercase tracking-wide text-on-surface-variant">
              {stat.label}
            </span>
          </div>
        ))}
      </Reveal>
    </BeatSection>
  );
}
