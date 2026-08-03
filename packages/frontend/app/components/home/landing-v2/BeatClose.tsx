import { SectionHeading } from "@/app/components/marketing";
import { BeatSection } from "./BeatSection";
import { PrimaryCta } from "./PrimaryCta";
import { Reveal } from "./Reveal";

/**
 * Final beat — "The Close" (one ask: start now).
 *
 * The closer for the variant-B guided-narrative funnel. It makes a single,
 * confident point — stop guessing, start knowing — and offers one prominent,
 * centered conversion action. Reverse-trial reassurance (every account starts
 * on Pro, no card) lowers the cost of the click.
 *
 * The vertical space now comes from the shared section rhythm rather than a
 * bespoke py-28/md:py-36, which stacked on top of the band's own padding.
 *
 * Server-rendered; the only client behavior is the scroll fade (Reveal) and the
 * already-client PrimaryCta (opens the email-first AnonCaptureModal).
 */
export function BeatClose() {
  return (
    <BeatSection id="beat-close" surface="b" className="text-center">
      <Reveal className="flex flex-col items-center">
        <SectionHeading
          title="Stop guessing which market. Start knowing."
          subhead="Every account starts on Pro. No credit card. Cancel anytime."
        />

        <PrimaryCta
          source="close"
          label="Start free — no credit card"
          subtext={null}
        />
      </Reveal>
    </BeatSection>
  );
}
