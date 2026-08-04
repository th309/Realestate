import { ArrowRight } from "lucide-react";
import { HEADING, Section } from "@/app/components/marketing";
import { PrimaryCta } from "./PrimaryCta";
import { Reveal } from "./Reveal";

/**
 * The closing ask.
 *
 * It keeps the faded-indigo band it has always had. The mockup put the closer
 * on the same pale wash as the hero to bracket the page, but that wash reads
 * as a different, lighter surface than the rest of the site and losing the
 * indigo here was a downgrade. The hero keeps the wash; the close does not.
 *
 * Green rather than indigo: indigo owns product chrome, green owns the ask
 * (the two-accent split in CLAUDE.md section 8.2).
 *
 * Reverse-trial reassurance sits above the button, not below it, so the last
 * thing read before the click is the price.
 *
 * Server-rendered; the only client behavior is the scroll fade (Reveal) and the
 * already-client PrimaryCta (opens the email-first AnonCaptureModal).
 */
export function BeatClose() {
  return (
    <Section id="beat-close" surface="b">
      <div className="text-center">
        <Reveal className="flex flex-col items-center">
          <h2
            className={`${HEADING.section} mb-3.5 text-balance text-on-surface`}
          >
            Ready to score your first market?
          </h2>
          <p className="text-[16.5px] text-on-surface-variant">
            Free account, no credit card required · Every account starts on Pro
          </p>
          <PrimaryCta
            source="close"
            label="Get Started Free"
            subtext={null}
            accent="tertiary"
            icon={<ArrowRight className="size-[19px]" strokeWidth={2.4} />}
            className="mt-7"
          />
        </Reveal>
      </div>
    </Section>
  );
}
