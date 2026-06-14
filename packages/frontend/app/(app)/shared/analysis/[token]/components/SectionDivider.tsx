interface Props {
  num: string;
  label: string;
}

/**
 * Editorial section divider. Renders as a horizontal rule with the section
 * number floating in accent color above the H1. Used at the top of pages
 * 2–5 in the PDF layout.
 *
 *   ─── § 02 ───────────────────────────────────────────
 */
export function SectionDivider({ num, label }: Props) {
  return (
    <div className="section-divider" aria-label={`Section ${num}: ${label}`}>
      <span className="num">§ {num}</span>
      <span className="rule" />
    </div>
  );
}
