"use client";
import { VerdictBadge } from "./VerdictBadge";
import { AIQuoteHeader } from "./AIQuoteHeader";
import { KPIStrip } from "./KPIStrip";
import type { KPITileProps } from "./KPITile";
import type { Verdict } from "../../lib/format-helpers";

interface HeroProps {
  verdict: Verdict;
  aiText?: string | null;
  aiIsStreaming?: boolean;
  /** Legacy KPI tiles. Omit when rendering <StrategyKPI/> as a sibling instead. */
  kpiTiles?: KPITileProps[];
}

export function Hero({ verdict, aiText, aiIsStreaming, kpiTiles }: HeroProps) {
  return (
    <section
      data-hero
      className="rounded-2xl bg-surface border border-outline-variant p-6 md:p-8"
    >
      <div
        className={`grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center ${
          kpiTiles ? "mb-6" : ""
        }`}
      >
        <div className="flex justify-center md:justify-start">
          <VerdictBadge verdict={verdict} />
        </div>
        <div>
          <AIQuoteHeader text={aiText} isStreaming={aiIsStreaming} />
        </div>
      </div>
      {kpiTiles && <KPIStrip tiles={kpiTiles} />}
    </section>
  );
}
