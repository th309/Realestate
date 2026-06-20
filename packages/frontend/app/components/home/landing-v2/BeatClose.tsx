import { BeatSection } from "./BeatSection";
import { PrimaryCta } from "./PrimaryCta";
import { Reveal } from "./Reveal";

/**
 * Final beat — "The Close" (one ask: start now).
 *
 * The closer for the variant-B guided-narrative funnel. It makes a single,
 * confident point — stop guessing, start knowing — and offers one prominent,
 * centered conversion action. Reverse-trial reassurance (every account starts
 * on Pro, no card) lowers the cost of the click. Sits at the bottom of the
 * page's fixed indigo→light gradient, so it reads dark-on-light via
 * BeatSection's tone="light" (spec §4.0), with generous vertical space and
 * center alignment to let the moment land.
 *
 * Server-rendered; the only client behavior is the scroll fade (Reveal) and the
 * already-client PrimaryCta (opens the email-first AnonCaptureModal).
 */
export function BeatClose() {
  return (
    <BeatSection
      id="beat-close"
      tone="light"
      className="py-28 text-center md:py-36"
    >
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center">
        <h2 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-on-surface sm:text-5xl md:text-6xl">
          Stop guessing which market. Start knowing.
        </h2>

        <p className="mt-6 max-w-md text-base leading-relaxed text-on-surface-variant sm:text-lg">
          Every account starts on Pro. No credit card. Cancel anytime.
        </p>

        <PrimaryCta
          source="close"
          label="Start free — no credit card"
          subtext={null}
          className="mt-10"
        />
      </Reveal>
    </BeatSection>
  );
}
