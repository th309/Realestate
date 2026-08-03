import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { SectionHeading, StatTile } from "@/app/components/marketing";
import { BeatSection } from "./BeatSection";
import { Reveal } from "./Reveal";

/**
 * Supporting beat — "The Data" (depth + freshness).
 *
 * A brief, quiet beat sitting between the proof and the close. It makes one
 * understated point — the data is both deep (two decades of history) and fresh
 * (refreshed monthly) — without the visual weight of a headline beat.
 *
 * Coverage figures come from COVERAGE_COPY, never hardcoded (CLAUDE.md §9).
 *
 * Server-rendered; the only client behavior is the staggered scroll fade from
 * the already-client Reveal primitive.
 */

const COVERAGE_STATS: { value: string; label: string }[] = [
  { value: COVERAGE_COPY.metros, label: "metros" },
  { value: COVERAGE_COPY.counties, label: "counties" },
  { value: COVERAGE_COPY.zips, label: "ZIP codes" },
];

const SOURCES = ["Zillow", "Realtor.com", "Census", "FRED", "BLS"];

export function BeatDataDepth() {
  return (
    <BeatSection id="beat-data-depth" surface="a">
      <SectionHeading
        eyebrow="The data"
        title="Two decades of history. Refreshed every month."
        align="start"
      />

      <Reveal>
        <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
          History backfilled to{" "}
          <span className="font-mono font-medium tabular-nums text-on-surface">
            2001
          </span>
          , so every market is read against where it has actually been.
        </p>
      </Reveal>

      <Reveal delayMs={70} className="mt-3">
        <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
          <span className="font-mono font-medium tabular-nums text-on-surface">
            {COVERAGE_COPY.metros}
          </span>{" "}
          metros,{" "}
          <span className="font-mono font-medium tabular-nums text-on-surface">
            {COVERAGE_COPY.counties}
          </span>{" "}
          counties, and{" "}
          <span className="font-mono font-medium tabular-nums text-on-surface">
            {COVERAGE_COPY.zips}
          </span>{" "}
          ZIPs scored every month from {SOURCES.join(", ")}.
        </p>
      </Reveal>

      <Reveal delayMs={140} className="mt-8 grid gap-4 sm:grid-cols-3">
        {COVERAGE_STATS.map((stat) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            accent="tertiary"
          />
        ))}
      </Reveal>
    </BeatSection>
  );
}
