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
    <BeatSection
      id="beat-persona"
      eyebrow="What you can do with it"
      tone="light"
    >
      <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">
        Pick your angle. See the real output.
      </h2>
      <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
        Not a feature list — actual answers from the live platform. Investor,
        agent, first-time buyer, or building on our API: here&apos;s what
        PropertyIQ hands you for a real market.
      </p>
      <PersonaShowcase />
    </BeatSection>
  );
}
