"use client";

import { Section } from "./Section";

interface Stat {
  lbl: string;
  val: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
}

interface Props {
  stats: Stat[];
  limitedData: boolean;
}

export function MarketNow({ stats, limitedData }: Props) {
  if (limitedData || stats.length === 0) {
    return (
      <Section num="02" title="The market right now">
        <p className="text-sm text-on-surface-variant">
          Limited data available for this market. Try a nearby metro for richer
          signals.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="02"
      title="The market right now"
      subtitle="Where this market stands as of today, with one-quarter momentum."
    >
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.lbl} className="rounded-xl bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              {s.lbl}
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-on-surface">
              {s.val}
            </p>
            {s.delta && (
              <p
                className={`mt-0.5 text-[11.5px] font-medium ${
                  s.deltaDir === "up"
                    ? "text-tertiary"
                    : s.deltaDir === "down"
                      ? "text-error"
                      : "text-on-surface-variant"
                }`}
              >
                {s.delta}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
