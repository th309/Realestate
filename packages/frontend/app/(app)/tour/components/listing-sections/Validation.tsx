"use client";

import { Section } from "./Section";

interface Props {
  metrosValidated: number;
  countiesValidated: number;
  zipsValidated: number;
  backtestYears: number;
  /** within-state top-vs-bottom-band dollar alpha, e.g. "$7,247" */
  dollarAlpha: string;
  /** sanctioned out-of-sample information-coefficient statement */
  icStatement: string;
  /** sanctioned quintile/outperformance statement (excess vs state) */
  outperformanceStatement: string;
  /** sanctioned reliability statement */
  hitRateStatement: string;
  limitedData: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export function Validation(p: Props) {
  if (p.limitedData) {
    return (
      <Section num="09" title="PropertyIQ's validated track record">
        <p className="text-sm text-on-surface-variant">
          Validation data unavailable.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="09"
      title="PropertyIQ's validated track record"
      subtitle="How well has the PropertyIQ Score predicted market outperformance historically?"
    >
      <div className="rounded-2xl border border-tertiary/30 bg-tertiary-container/40 p-6">
        <div className="flex items-start gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-tertiary text-3xl text-on-tertiary">
            ✓
          </div>
          <div className="space-y-2">
            <p className="text-[15px] font-semibold text-on-surface">
              Out-of-sample validated across {fmt(p.metrosValidated)} metros,{" "}
              {fmt(p.countiesValidated)} counties, and {fmt(p.zipsValidated)}{" "}
              ZIPs over {p.backtestYears} years.
            </p>
            <p className="text-[13px] leading-snug text-on-surface">
              {p.outperformanceStatement}
            </p>
            <p className="text-[13px] leading-snug text-on-surface">
              {p.icStatement}
            </p>
            <p className="text-[12px] leading-snug text-on-surface-variant">
              Reliability: {p.hitRateStatement}. Within-state top-vs-bottom-band
              advantage of about{" "}
              <strong className="font-mono text-tertiary">
                {p.dollarAlpha}
              </strong>{" "}
              per property over 3 years.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
