"use client";

/**
 * MARKET MOMENTUM MAP — standalone, drop-anywhere widget.
 *
 * Population-scaled dot map of every scored US metro colored by PropertyIQ
 * score, with 25-year monthly playback and era context labels. Fully public
 * data; place it on any page with <MarketMomentumMap size="hero" />.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CBSA_TO_METRO, COVERAGE_COPY, useScoreHeatmap } from "@/lib/data";
import { MomentumMapCanvas } from "./MomentumMapCanvas";
import { MomentumMapTimeline, formatMonthLabel } from "./MomentumMapTimeline";
import { MomentumSummaryStrip } from "./MomentumSummaryStrip";
import { eraForMonth } from "./market-eras";
import {
  momentumLegendGradient,
  type MomentumColorMode,
} from "./momentum-map-colors";
import { projectMetros, type ProjectedMetro } from "./momentum-map-projection";
import { useMomentumColorMode } from "./useMomentumColorMode";
import { useMomentumPlayback } from "./useMomentumPlayback";
import { useUsStatesBasemap } from "./useUsStatesBasemap";

export interface MarketMomentumMapProps {
  /** hero: <=960px with summary strip + speed control; card: <=480px condensed */
  size?: "hero" | "card";
  className?: string;
}

const DOT_RADII = { minRadius: 1.5, maxRadius: 22 } as const;

const CARD_CHROME =
  "rounded-xl border border-outline-variant bg-surface-container-low shadow-sm";

function sizeClasses(size: "hero" | "card"): string {
  return size === "hero" ? "max-w-[960px] p-6" : "max-w-[480px] p-4";
}

export function MarketMomentumMap({
  size = "hero",
  className = "",
}: MarketMomentumMapProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useScoreHeatmap();
  const statePaths = useUsStatesBasemap();
  const colorMode = useMomentumColorMode();

  const projected = useMemo(
    () => (data ? projectMetros(data.metros, DOT_RADII) : []),
    [data],
  );
  const playback = useMomentumPlayback(data?.months.length ?? 0);

  if (isLoading) {
    return <MomentumMapSkeleton size={size} className={className} />;
  }

  if (isError || !data) {
    return (
      <div
        className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
      >
        <p className="text-sm text-on-surface-variant">
          The momentum map couldn&apos;t load.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm text-on-primary transition-colors duration-200 hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const latestFrame = data.months.length - 1;
  const currentMonth = data.months[playback.currentFrame];
  const era = currentMonth ? eraForMonth(currentMonth) : null;

  const hrefFor = (metro: ProjectedMetro): string | null => {
    const match = CBSA_TO_METRO.get(metro.id);
    return match ? `/markets/${match.slug}` : null;
  };

  return (
    <figure
      data-testid={`momentum-map-${size}`}
      aria-label="US market momentum heatmap with monthly playback"
      className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          className={`font-semibold text-on-surface ${size === "hero" ? "text-lg" : "text-base"}`}
        >
          U.S. Market Momentum
        </h3>
        <div className="text-right">
          <p
            data-testid="momentum-month-readout"
            className={`font-mono text-on-surface ${size === "hero" ? "text-2xl" : "text-lg"}`}
          >
            {formatMonthLabel(currentMonth)}
          </p>
          {era && <p className="text-xs text-primary">{era.caption}</p>}
        </div>
      </header>

      <MomentumMapCanvas
        metros={projected}
        statePaths={statePaths}
        scores={data.scores}
        currentFrame={playback.currentFrame}
        latestFrame={latestFrame}
        animate={!playback.prefersReducedMotion}
        colorMode={colorMode}
        hrefFor={hrefFor}
        onNavigate={(href) => router.push(href)}
      />

      <MomentumLegend colorMode={colorMode} />

      {size === "hero" && (
        <MomentumSummaryStrip
          scores={data.scores}
          currentFrame={playback.currentFrame}
          metros={data.metros}
        />
      )}

      <MomentumMapTimeline
        months={data.months}
        currentFrame={playback.currentFrame}
        isPlaying={playback.isPlaying}
        frameMs={playback.frameMs}
        size={size}
        onTogglePlay={playback.togglePlay}
        onSeek={playback.seek}
        onFrameMsChange={playback.setFrameMs}
      />

      <figcaption className="mt-3 text-xs text-on-surface-variant">
        {data.metros.length} metros scored monthly · Map shows contiguous US, AK
        &amp; HI · Pre-2016 history is momentum-only data
      </figcaption>
    </figure>
  );
}

function MomentumLegend({ colorMode }: { colorMode: MomentumColorMode }) {
  return (
    <div className="mt-3">
      <div
        className="h-2 w-full rounded-full"
        style={{ background: momentumLegendGradient(colorMode) }}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] tracking-wide text-on-surface-variant">
        <span>WEAK</span>
        <span>EASING</span>
        <span>STEADY</span>
        <span>FIRMING</span>
        <span>STRONG</span>
      </div>
    </div>
  );
}

function MomentumMapSkeleton({
  size,
  className,
}: {
  size: "hero" | "card";
  className: string;
}) {
  return (
    <div
      data-testid="momentum-map-skeleton"
      className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
    >
      <div className="h-5 w-48 animate-pulse rounded bg-surface-container-high" />
      <div className="mt-3 aspect-[975/610] w-full animate-pulse rounded-lg bg-surface-container" />
      <p className="mt-3 text-xs text-on-surface-variant">
        Loading momentum for {COVERAGE_COPY.metros} metros…
      </p>
    </div>
  );
}
