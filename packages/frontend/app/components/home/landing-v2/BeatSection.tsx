import type { ReactNode } from "react";
import { Section, type Surface } from "@/app/components/marketing";

/**
 * Section shell for a single landing-v2 narrative beat.
 *
 * Spacing, container width, and surface now come from the shared layout
 * contract — the homepage previously carried twelve distinct per-section
 * rhythms, its own `max-w-5xl` column, and a `px-5` gutter that matched
 * nothing else on the site.
 *
 * The old `tone` prop is gone. It flipped body copy to `text-on-primary`
 * (white) for beats sitting on the dark top of a page-wide indigo gradient;
 * now that every beat owns an opaque light band, each one carries light-band
 * tokens directly and adjacent beats separate by alternating `surface`.
 */
export function BeatSection({
  id,
  eyebrow,
  surface = "a",
  className = "",
  children,
}: {
  id?: string;
  eyebrow?: string;
  surface?: Surface;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Section id={id} surface={surface}>
      <div className={`text-on-surface ${className}`}>
        {eyebrow && (
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-primary">
            {eyebrow}
          </p>
        )}
        {children}
      </div>
    </Section>
  );
}
