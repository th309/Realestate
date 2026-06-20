import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { Reveal } from "./Reveal";
import { PrimaryCta } from "./PrimaryCta";

/**
 * Beat 4 — the Score (sticky centerpiece).
 *
 * The live cooler's PropertyIQ ring pins (CSS `position: sticky`, no scroll-
 * jacking) while three copy panels scroll past, then releases at the section
 * end. The whole beat sits on its own M3 surface panel so contrast holds at the
 * gradient's mid-page transition zone (spec §4.0). Score copy follows CLAUDE.md
 * §9 exactly: "50 = state average," computed nationally, calibrated to state —
 * never "ranked within state."
 *
 * The ring auto-fetches client-side (ScoreWidget) — fine here, it is well below
 * the fold and never touches the hero's LCP.
 */

const PANELS: { title: string; body: string }[] = [
  {
    title: "One number. 1 to 99.",
    body: "Every market gets a single PropertyIQ Score — its demand signal (price momentum, days on market, and price cuts) distilled into one honest number you can compare anywhere.",
  },
  {
    title: "50 is your state's average.",
    body: "The Score is computed nationally, across every market at once — then calibrated so 50 equals your state's average performance. Above 50, a market is outpacing its state; below, it's lagging.",
  },
  {
    title: "Confidence is separate.",
    body: "An A–F confidence grade tells you how complete the underlying data is — independent of the score itself. A high score built on thin data says so, right on the badge.",
  },
];

export function BeatScore({
  coolerCbsa,
  coolerName,
}: {
  coolerCbsa: string;
  coolerName: string;
}) {
  return (
    <section id="beat-score" className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl rounded-[28px] bg-surface p-6 text-on-surface shadow-lg md:p-12">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-primary">
          The Score
        </p>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          {/* Pinned ring — sticky on desktop, static on top for mobile. */}
          <div className="flex flex-col items-center justify-center gap-4 md:sticky md:top-[20vh] md:h-fit md:self-start">
            <ScoreWidget
              geographyType="metro"
              geographyId={coolerCbsa}
              scoreType="propertyiq"
              showConfidence
              size={220}
              strokeWidth={12}
            />
            <p className="font-mono text-sm text-on-surface-variant">
              {coolerName} · live
            </p>
          </div>

          {/* Copy panels scroll past the pinned ring. */}
          <div className="flex flex-col">
            {PANELS.map((panel, i) => (
              <div
                key={panel.title}
                className="flex min-h-[55vh] items-center md:min-h-[60vh]"
              >
                <Reveal>
                  <h3 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                    {panel.title}
                  </h3>
                  <p className="mt-4 max-w-md text-lg text-on-surface-variant">
                    {panel.body}
                  </p>
                  <p className="mt-3 font-mono text-xs uppercase tracking-wider text-primary">
                    {String(i + 1).padStart(2, "0")} / 03
                  </p>
                </Reveal>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 md:mt-8">
          <PrimaryCta source="after_score" />
        </div>
      </div>
    </section>
  );
}
