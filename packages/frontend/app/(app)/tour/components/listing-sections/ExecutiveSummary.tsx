"use client";

import { Section } from "./Section";

interface Props {
  thesisParagraphs: string[];
  recommendation: string;
  limitedData: boolean;
  num?: string;
}

export function ExecutiveSummary({
  thesisParagraphs,
  recommendation,
  limitedData,
  num = "01",
}: Props) {
  // The hero owns the score + lead verdict; this section is the full narrative.
  // Per the no-empty-sections rule, render nothing when there's no story.
  if (limitedData || thesisParagraphs.length === 0) return null;

  return (
    <Section
      num={num}
      title="Executive summary"
      subtitle="The 60-second story you'd tell a seller across a kitchen table."
    >
      <div className="max-w-3xl font-serif text-[17px] leading-[1.7] text-on-surface">
        {thesisParagraphs.map((p, i) => (
          <p key={i} className="mb-3.5 last:mb-0">
            {p}
          </p>
        ))}
      </div>
      {recommendation && (
        <div className="mt-5 rounded-r-xl border-l-[3px] border-tertiary bg-surface-container-lowest px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">
            The recommendation
          </p>
          <p className="mt-1 font-serif text-[15px] font-medium text-on-surface">
            {recommendation}
          </p>
        </div>
      )}
    </Section>
  );
}
