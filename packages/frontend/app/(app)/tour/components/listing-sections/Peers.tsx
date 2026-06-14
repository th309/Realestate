"use client";

import { Section } from "./Section";

interface Peer {
  name: string;
  scoreLabel: string;
  medianPrice: string;
  yoyGrowth: string;
  dom: string;
  soldAboveList: string;
  isSource?: boolean;
}

interface Props {
  peers: Peer[];
  limitedData: boolean;
}

export function Peers({ peers, limitedData }: Props) {
  if (limitedData || peers.length === 0) {
    return (
      <Section num="05" title="Where this market sits vs. its peers">
        <p className="text-sm text-on-surface-variant">
          No comparable peer markets available.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="05"
      title="Where this market sits vs. its peers"
      subtitle="PropertyIQ-matched comparables — same metro tier, similar demographics + size."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {peers.map((p) => (
          <div
            key={p.name}
            className={`rounded-xl p-4 ${
              p.isSource
                ? "border border-tertiary/30 bg-tertiary-container/40"
                : "bg-surface-container"
            }`}
          >
            <p className="text-[13px] font-semibold text-on-surface">
              {p.name}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {p.scoreLabel}
            </p>
            <dl className="mt-2.5 space-y-1 text-[11.5px]">
              <Row lbl="Median price" val={p.medianPrice} />
              <Row lbl="12-mo growth" val={p.yoyGrowth} />
              <Row lbl="Days on market" val={p.dom} />
              <Row lbl="Sold above list" val={p.soldAboveList} />
            </dl>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Row({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div className="flex justify-between border-t border-outline-variant/30 py-1 first:border-t-0">
      <span className="text-on-surface-variant">{lbl}</span>
      <span className="font-mono font-semibold text-on-surface">{val}</span>
    </div>
  );
}
