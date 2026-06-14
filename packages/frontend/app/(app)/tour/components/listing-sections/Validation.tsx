"use client";

import { Section } from "./Section";

interface Props {
  directionalAccuracy: number;
  observations: number;
  excessReturn3y: number;
  vsLabel: string;
  averageOutperformance: number;
  limitedData: boolean;
}

export function Validation(p: Props) {
  if (p.limitedData) {
    return (
      <Section num="09" title="PropertyIQ's track record here">
        <p className="text-sm text-on-surface-variant">
          Validation data unavailable.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="09"
      title="PropertyIQ's track record here"
      subtitle="How accurate has the score been historically?"
    >
      <div className="rounded-2xl border border-tertiary/30 bg-tertiary-container/40 p-6">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-tertiary text-3xl text-on-tertiary">
            ✓
          </div>
          <div>
            <p className="text-[15px] font-semibold text-on-surface">
              Validated against 3 years of outcomes
            </p>
            <p className="mt-1 text-[13px] leading-snug text-on-surface">
              Markets scored 80+ have outperformed the state median price growth
              by an average of{" "}
              <strong className="font-mono text-tertiary">
                +{p.averageOutperformance.toFixed(1)}%/yr
              </strong>{" "}
              over 36 months. Directional accuracy in this metro:{" "}
              <strong className="font-mono text-tertiary">
                {p.directionalAccuracy}%
              </strong>{" "}
              across {p.observations} observations.{" "}
              <strong className="font-mono text-tertiary">
                3-year excess return: {p.excessReturn3y > 0 ? "+" : ""}
                {p.excessReturn3y.toFixed(1)}%
              </strong>{" "}
              vs {p.vsLabel}.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
