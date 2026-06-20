"use client";

import { Section } from "./Section";

interface Action {
  title: string;
  desc: string;
}

interface Props {
  strategyParagraphs: string[];
  actions: Action[];
  fallbackUsed: boolean;
  /** Set by the adapter; consumed by the parent's drop-empty filter. */
  limitedData?: boolean;
  num?: string;
  /** Persona-specific framing; defaults to the agent (listing-presentation) copy. */
  title?: string;
  subtitle?: string;
}

export function AiStrategy({
  strategyParagraphs,
  actions,
  fallbackUsed,
  num = "10",
  title = "Recommended seller strategy",
  subtitle = "PropertyIQ's AI synthesizes the data above into a positioning playbook.",
}: Props) {
  const hasContent = strategyParagraphs.length > 0 || actions.length > 0;

  if (!hasContent) {
    return (
      <Section num={num} title={title} subtitle={subtitle}>
        <p className="text-sm text-on-surface-variant">
          AI-generated strategy unavailable for this market. The structured
          signals above remain accurate.
        </p>
      </Section>
    );
  }

  return (
    <Section num={num} title={title} subtitle={subtitle}>
      <div className="relative rounded-2xl border border-primary-container bg-gradient-to-b from-surface-container-lowest to-surface px-7 py-6">
        <span className="absolute -top-2.5 left-6 bg-surface px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {"✦"} AI Strategy{fallbackUsed && " (fallback)"}
        </span>
        <div className="font-serif text-[14px] leading-[1.75] text-on-surface">
          {strategyParagraphs.map((p, i) => (
            <p key={i} className="mb-3.5 last:mb-0">
              {p}
            </p>
          ))}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {actions.map((a, i) => (
            <div
              key={i}
              className="relative rounded-xl border-[1.5px] border-primary-container bg-surface p-4"
            >
              <span className="absolute -top-2.5 left-4 rounded-md bg-on-primary-container px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[13px] font-semibold text-on-surface">
                {a.title}
              </p>
              <p className="mt-1.5 text-[12px] leading-snug text-on-surface-variant">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
