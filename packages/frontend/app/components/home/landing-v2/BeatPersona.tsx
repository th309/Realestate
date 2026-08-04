import { SectionHeading } from "@/app/components/marketing";
import { BeatSection } from "./BeatSection";
import { PersonaShowcase } from "./persona/PersonaShowcase";

/**
 * Beat 7 — the persona branch (show, don't tell).
 *
 * Four co-equal tabs (Investor default), each leading with the feature that
 * persona cares about, shown as REAL frozen product output (spec §5.1, §6) —
 * never an icon-and-blurb grid. The keyboard-accessible segmented control +
 * panels live in PersonaShowcase. The Power-user tab surfaces a genuine MCP
 * exchange — PropertyIQ's top differentiator — co-equal but not the default.
 */
export function BeatPersona() {
  return (
    <BeatSection id="beat-persona" surface="b">
      <SectionHeading
        title="The edge that shows up before the headlines do"
        subhead="Whether you're deploying your own capital or advising clients, PropertyIQ replaces market intuition with a number you can defend. Every panel below is real output from the live platform, not a feature list."
      />
      <PersonaShowcase />
    </BeatSection>
  );
}
