import { BeatSection } from "./BeatSection";
import { Reveal } from "./Reveal";

/**
 * Beat 2 — the tension (Problem → Agitate).
 *
 * The PAS turn after the hero's verdict: picking a market on gut feel is
 * guessing, because the sources disagree and there are simply too many markets
 * to track by feel. One idea, agitated three ways — no CTA on this beat (that
 * comes later in the funnel). Server-rendered on the dark top of the page's
 * fixed indigo→light gradient, so it reads light-on-dark via BeatSection's
 * tone="dark" (spec §4.0). The only client behavior is the staggered scroll
 * fade of each agitate point, handled by the already-client Reveal primitive.
 */

const AGITATE_POINTS: {
  /** Leading run rendered in font-mono (the stats), when present. */
  monoLead?: string;
  /** Rest of the lead line, default Roboto. */
  lead: string;
  sublabel: string;
}[] = [
  {
    monoLead: "935",
    lead: "metros. 3,150 counties. 34,000 ZIPs.",
    sublabel: "More markets than anyone can track by feel.",
  },
  {
    lead: "Conflicting numbers from every source.",
    sublabel:
      "Median price, rent, momentum — each site tells a different story.",
  },
  {
    lead: "One wrong market sets you back years.",
    sublabel: "The cost of guessing compounds.",
  },
];

function AgitatePoint({
  monoLead,
  lead,
  sublabel,
}: {
  monoLead?: string;
  lead: string;
  sublabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-primary-light/25 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
      <p className="text-2xl font-semibold leading-tight tracking-tight text-on-primary md:text-3xl">
        {monoLead && <span className="font-mono">{monoLead} </span>}
        {lead}
      </p>
      <p className="text-base leading-relaxed text-primary-light">{sublabel}</p>
    </div>
  );
}

export function BeatTension() {
  return (
    <BeatSection id="beat-tension" eyebrow="The problem" tone="dark">
      <Reveal>
        <h2 className="max-w-3xl font-serif text-3xl font-semibold leading-[1.05] tracking-tight text-on-primary sm:text-4xl md:text-5xl">
          Zillow says one thing. Realtor.com says another. You&apos;re supposed
          to just&hellip; know?
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-8 md:mt-16 md:grid-cols-3 md:gap-0">
        {AGITATE_POINTS.map((point, index) => (
          <Reveal key={point.lead} delayMs={index * 70}>
            <AgitatePoint
              monoLead={point.monoLead}
              lead={point.lead}
              sublabel={point.sublabel}
            />
          </Reveal>
        ))}
      </div>
    </BeatSection>
  );
}
