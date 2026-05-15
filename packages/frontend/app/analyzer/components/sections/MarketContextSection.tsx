"use client";
import { SectionWrapper } from "./SectionWrapper";
import { ScoreRingChart } from "../charts/ScoreRingChart";
import { AIAnnotation } from "../ai/AIAnnotation";

interface MarketContextSectionProps {
  piqScore: number | null;
  piqLabel?: string | null;
  homeValue: number | null;
  rentIndex: number | null;
  marketHeat: number | null;
  netMigration: number | null;
  aiText?: string | null;
  aiIsStale?: boolean;
  onRefreshAi?: () => void;
}

const fmtUsd = (v: number | null) =>
  v == null ? "—" : `$${Math.round(v / 1000)}K`;
const fmtNum = (v: number | null) => (v == null ? "—" : v.toLocaleString());
const fmtIdx = (v: number | null) => (v == null ? "—" : v.toFixed(1));

export function MarketContextSection({
  piqScore,
  piqLabel,
  homeValue,
  rentIndex,
  marketHeat,
  netMigration,
  aiText,
  aiIsStale,
  onRefreshAi,
}: MarketContextSectionProps) {
  return (
    <SectionWrapper
      id="market_context"
      title="Market Context"
      onRefresh={onRefreshAi}
      aiAnnotation={
        <AIAnnotation
          text={aiText}
          isStale={aiIsStale}
          onRefresh={onRefreshAi}
        />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-center">
        <div data-piq-tile className="flex flex-col items-center gap-1">
          {piqScore != null ? (
            <ScoreRingChart
              score={piqScore}
              max={100}
              size={160}
              label={piqLabel ?? "PIQ Score"}
            />
          ) : (
            <div className="text-xs text-on-surface-variant">
              PIQ Score unavailable
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Home Value (median)" value={fmtUsd(homeValue)} />
          <Stat label="Rent Index" value={fmtNum(rentIndex)} />
          <Stat label="Market Heat" value={fmtIdx(marketHeat)} />
          <Stat label="Net Migration" value={fmtNum(netMigration)} />
        </div>
      </div>
    </SectionWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      data-stat-card
      className="rounded-xl border border-outline-variant bg-surface-container-low p-3"
    >
      <div className="text-[10px] uppercase font-semibold text-on-surface-variant tracking-wider mb-1">
        {label}
      </div>
      <div className="font-mono text-xl font-bold text-on-surface">{value}</div>
    </div>
  );
}
