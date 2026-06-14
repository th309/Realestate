"use client";

import { Section } from "./Section";

interface Inflow {
  fromName: string;
  count: number;
}

interface DemoRow {
  lbl: string;
  val: string;
}

interface Props {
  inflows: Inflow[];
  demographics: DemoRow[];
  limitedData: boolean;
}

export function Migration({ inflows, demographics, limitedData }: Props) {
  if (limitedData) {
    return (
      <Section num="06" title="Who lives here · who's moving here">
        <p className="text-sm text-on-surface-variant">
          Migration data is limited for this market. Try a larger metro or
          county.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="06"
      title="Who lives here · who's moving here"
      subtitle="Demographics + migration patterns. Where buyers come from, what they earn, what they want."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Top 5 in-migration sources · last 12 months
          </p>
          <ul className="mt-2 divide-y divide-outline-variant/30">
            {inflows.map((f) => (
              <li
                key={f.fromName}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <span className="font-medium text-on-surface">
                  {f.fromName}
                </span>
                <span className="font-mono font-semibold text-on-primary-container">
                  +{f.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Demographics
          </p>
          <ul className="mt-2 divide-y divide-outline-variant/30">
            {demographics.map((d) => (
              <li
                key={d.lbl}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <span className="font-medium text-on-surface">{d.lbl}</span>
                <span className="font-mono font-semibold text-on-primary-container">
                  {d.val}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
