"use client";

import { Section } from "./Section";
import { EmploymentBars } from "../charts/EmploymentBars";

interface Bar {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}

interface Props {
  sectors: Bar[];
  signals: Bar[];
  limitedData: boolean;
}

export function Employment({ sectors, signals, limitedData }: Props) {
  if (limitedData) {
    return (
      <Section num="08" title="Economic drivers">
        <p className="text-sm text-on-surface-variant">
          Sector breakdown unavailable for this market.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="08"
      title="Economic drivers"
      subtitle="The job market, wage growth, and structural employer mix that anchor demand."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-[12px] font-semibold text-on-surface">
            Employment by sector
          </p>
          <div className="mt-2">
            <EmploymentBars rows={sectors} />
          </div>
        </div>
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-[12px] font-semibold text-on-surface">
            Labor market signals
          </p>
          <div className="mt-2">
            <EmploymentBars rows={signals} />
          </div>
        </div>
      </div>
    </Section>
  );
}
