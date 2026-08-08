import { SectionHeading } from "@/app/components/marketing";
import { BeatSection } from "./BeatSection";
import { PersonaBand } from "./persona/PersonaBand";

/**
 * The persona branch, built from the approved mockup: a green toggle over a
 * green-bordered card, the pitch on the left and the proof points on the
 * right.
 *
 * This replaced a four-tab showcase of frozen product output. That version was
 * richer, but it was not the approved design, and keeping it meant the page
 * carried a section the mockup does not have while missing the one it does.
 * The real-output panels it rendered still exist in `PersonaShowcase` /
 * `snapshots.ts` if they earn a band of their own later.
 */
export function BeatPersona() {
  return (
    <BeatSection id="beat-persona" surface="none">
      <SectionHeading
        tone="onDark"
        title="The edge that shows up before the headlines do"
        subhead="Whether you're deploying your own capital or advising clients, PropertyIQ replaces market intuition with a number you can defend."
      />
      <PersonaBand />
    </BeatSection>
  );
}
