"use client";
import { GradeRing } from "./GradeRing";
import { AIQuoteHeader } from "./AIQuoteHeader";
import { KPIStrip } from "./KPIStrip";
import type { KPITileProps } from "./KPITile";

interface HeroProps {
  score: number;
  aiText?: string | null;
  aiIsStreaming?: boolean;
  kpiTiles: KPITileProps[];
}

export function Hero({ score, aiText, aiIsStreaming, kpiTiles }: HeroProps) {
  return (
    <section
      data-hero
      className="rounded-2xl bg-surface border border-outline-variant p-6 md:p-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center mb-6">
        <div className="flex justify-center md:justify-start">
          <GradeRing score={score} />
        </div>
        <div>
          <AIQuoteHeader text={aiText} isStreaming={aiIsStreaming} />
        </div>
      </div>
      <KPIStrip tiles={kpiTiles} />
    </section>
  );
}
