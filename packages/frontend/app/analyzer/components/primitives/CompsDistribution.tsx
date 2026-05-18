"use client";

import { useMemo, useState } from "react";
import { bin as d3bin, max as d3max, min as d3min } from "d3-array";
import { scaleLinear } from "d3-scale";
import { piq } from "./piqTokens";
import { useContainerWidth } from "./DirectionalBarsHelpers";
import { CompsTooltip } from "./CompsDistributionTooltip";
import {
  collapsedTopRoundedPath,
  computePercentile,
  formatPriceSqft,
  ordinal,
  topRoundedPath,
  type Comp,
  type CompsHover,
} from "./CompsDistributionHelpers";

export type { Comp } from "./CompsDistributionHelpers";

export type CompsDistributionProps = {
  comps: Comp[];
  subjectPricePerSqft: number;
  /** Optional address for the subject — surfaced in the reference-line tooltip. */
  subjectAddress?: string;
  bins?: number;
  height?: number;
  className?: string;
  /**
   * Value formatter for x-axis ticks, bar tooltips, and the subject pill.
   * Defaults to `formatPriceSqft` (e.g. "$212"). Override to swap in a
   * different unit — e.g. a price-only fallback when comps lack sqft.
   */
  formatValue?: (value: number) => string;
  /**
   * Unit suffix appended to value labels — defaults to " / sqft". Override
   * to "" (or " sale price") when reusing the chart for a non-sqft metric.
   */
  unitLabel?: string;
  /** Label used for the subject pill, e.g. "this deal" (default) or "list price". */
  subjectPillSubject?: string;
};

const PADDING = { top: 56, right: 24, bottom: 36, left: 24 };
const BAR_GAP = 2;
const BAR_RADIUS = 4;
const BAR_STAGGER_S = 0.04;
const BAR_DUR_S = 0.8;
const LINE_DELAY_AFTER_BARS_S = 0.2;
const LINE_DUR_S = 0.35;
const EASE_SPLINE = "0.22 0.61 0.36 1";

export function CompsDistribution({
  comps,
  subjectPricePerSqft,
  subjectAddress,
  bins = 12,
  height = 200,
  className = "",
  formatValue = formatPriceSqft,
  unitLabel = " / sqft",
  subjectPillSubject = "this deal",
}: CompsDistributionProps) {
  const [hover, setHover] = useState<CompsHover>(null);
  const { ref, width } = useContainerWidth();

  const innerWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const innerHeight = Math.max(0, height - PADDING.top - PADDING.bottom);

  const prices = useMemo(() => comps.map((c) => c.pricePerSqft), [comps]);
  const xDomain = useMemo<[number, number]>(() => {
    const allValues = [...prices, subjectPricePerSqft];
    const lo = d3min(allValues) ?? 0;
    const hi = d3max(allValues) ?? 1;
    return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  }, [prices, subjectPricePerSqft]);

  const xScale = useMemo(
    () => scaleLinear().domain(xDomain).range([0, innerWidth]).nice(),
    [xDomain, innerWidth],
  );

  const histBins = useMemo(() => {
    const binMaker = d3bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(bins);
    return binMaker(prices);
  }, [prices, bins, xScale]);

  const yScale = useMemo(() => {
    const maxCount = d3max(histBins, (b) => b.length) ?? 1;
    return scaleLinear()
      .domain([0, maxCount === 0 ? 1 : maxCount])
      .range([innerHeight, 0]);
  }, [histBins, innerHeight]);

  const baselineY = innerHeight;
  const subjectX = xScale(subjectPricePerSqft);

  const subjectBinIndex = useMemo(
    () =>
      histBins.findIndex(
        (b) =>
          subjectPricePerSqft >= (b.x0 ?? -Infinity) &&
          subjectPricePerSqft < (b.x1 ?? Infinity),
      ),
    [histBins, subjectPricePerSqft],
  );

  const sortedPrices = useMemo(
    () => [...prices].sort((a, b) => a - b),
    [prices],
  );
  const medianPrice =
    sortedPrices[Math.floor(sortedPrices.length / 2)] ?? subjectPricePerSqft;
  const minPrice = sortedPrices[0] ?? subjectPricePerSqft;
  const maxPrice = sortedPrices[sortedPrices.length - 1] ?? subjectPricePerSqft;

  const percentile = computePercentile(comps, subjectPricePerSqft);
  const lineBeginS =
    Math.max(0, histBins.length - 1) * BAR_STAGGER_S +
    BAR_DUR_S +
    LINE_DELAY_AFTER_BARS_S;
  const overlayDelayS = (lineBeginS + LINE_DUR_S * 0.5).toFixed(3);

  const tooltip = (() => {
    if (!hover || width === 0) return null;
    if (hover.kind === "bar") {
      const b = histBins[hover.index];
      if (!b) return null;
      const bx = xScale(b.x0 ?? 0);
      const bw = Math.max(0, xScale(b.x1 ?? 0) - bx - BAR_GAP);
      return {
        x: PADDING.left + bx + bw / 2,
        y: PADDING.top + yScale(b.length),
        label: `${formatValue(b.x0 ?? 0)}–${formatValue(b.x1 ?? 0)}${unitLabel}`,
        sub: `${b.length} comp${b.length === 1 ? "" : "s"}`,
      };
    }
    return {
      x: PADDING.left + subjectX,
      y: PADDING.top,
      label: subjectAddress ?? "Subject property",
      sub: `${formatValue(subjectPricePerSqft)}${unitLabel}`,
    };
  })();

  return (
    <div className={className} style={{ width: "100%" }}>
      <div ref={ref} style={{ width: "100%", height, position: "relative" }}>
        {width > 0 && (
          <svg width={width} height={height} style={{ display: "block" }}>
            <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
              {histBins.map((b, i) => {
                const bx = xScale(b.x0 ?? 0);
                const bw = Math.max(0, xScale(b.x1 ?? 0) - bx - BAR_GAP);
                const bh = baselineY - yScale(b.length);
                if (bh <= 0 || bw <= 0) return null;
                const isSubjectBin = i === subjectBinIndex;
                const isHovered = hover?.kind === "bar" && hover.index === i;
                const baseOpacity = isSubjectBin ? 0.8 : 0.2;
                const opacity = isHovered && !isSubjectBin ? 0.4 : baseOpacity;
                const beginS = (i * BAR_STAGGER_S).toFixed(3);
                const collapsed = collapsedTopRoundedPath(bx, baselineY, bw);
                const expanded = topRoundedPath(
                  bx,
                  baselineY,
                  bw,
                  bh,
                  BAR_RADIUS,
                );
                return (
                  <path
                    key={`bar-${i}`}
                    d={collapsed}
                    fill={piq.indigo}
                    fillOpacity={opacity}
                    onMouseEnter={() => setHover({ kind: "bar", index: i })}
                    onMouseLeave={() => setHover(null)}
                    style={{ transition: "fill-opacity 120ms ease" }}
                  >
                    <animate
                      attributeName="d"
                      from={collapsed}
                      to={expanded}
                      dur={`${BAR_DUR_S}s`}
                      begin={`${beginS}s`}
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines={EASE_SPLINE}
                      fill="freeze"
                    />
                  </path>
                );
              })}

              <line
                x1={subjectX}
                x2={subjectX}
                y1={baselineY}
                y2={baselineY}
                stroke={piq.indigo}
                strokeWidth={1.5}
                style={{ cursor: "help" }}
                onMouseEnter={() => setHover({ kind: "subject" })}
                onMouseLeave={() => setHover(null)}
              >
                <animate
                  attributeName="y2"
                  from={baselineY}
                  to={0}
                  dur={`${LINE_DUR_S}s`}
                  begin={`${lineBeginS.toFixed(3)}s`}
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines={EASE_SPLINE}
                  fill="freeze"
                />
              </line>

              {(() => {
                // Hide the min/max label when its x-position is within ~46px
                // of the median label — otherwise the labels run into each
                // other (e.g. subject at $212 vs median at $253 in a narrow
                // chart). Median always stays anchored as the reference.
                // Account for label widths: "$212" ≈ 28px (anchor=start, extends right)
                // "$253 median" ≈ 90px (anchor=middle, extends both ways → ~45px each side).
                // Min gap = end-of-min + half-of-median ≈ 75px to fully clear.
                // Also suppress min/max when they duplicate the subject value
                // already shown in the pill above the chart (within $2/sqft).
                const MIN_GAP_PX = 75;
                const SUBJECT_DEDUPE_USD = 2;
                const xMin = xScale(minPrice);
                const xMed = xScale(medianPrice);
                const xMax = xScale(maxPrice);
                const minMatchesSubject =
                  Math.abs(minPrice - subjectPricePerSqft) < SUBJECT_DEDUPE_USD;
                const maxMatchesSubject =
                  Math.abs(maxPrice - subjectPricePerSqft) < SUBJECT_DEDUPE_USD;
                const ticks = [
                  {
                    v: minPrice,
                    label: formatValue(minPrice),
                    anchor: "start" as const,
                    show:
                      !minMatchesSubject && Math.abs(xMin - xMed) >= MIN_GAP_PX,
                  },
                  {
                    v: medianPrice,
                    label: `${formatValue(medianPrice)} median`,
                    anchor: "middle" as const,
                    show: true,
                  },
                  {
                    v: maxPrice,
                    label: formatValue(maxPrice),
                    anchor: "end" as const,
                    show:
                      !maxMatchesSubject && Math.abs(xMax - xMed) >= MIN_GAP_PX,
                  },
                ];
                return ticks
                  .filter((t) => t.show)
                  .map((t, i) => (
                    <text
                      key={`tick-${i}`}
                      x={xScale(t.v)}
                      y={baselineY + 18}
                      textAnchor={t.anchor}
                      style={{
                        fontSize: "11px",
                        fill: piq.textMuted,
                        fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {t.label}
                    </text>
                  ));
              })()}
            </g>
          </svg>
        )}

        {width > 0 &&
          (() => {
            // Clamp the pill anchor so it never slides past the chart's
            // left/right edges. When subject is at the leftmost bin (e.g.
            // $212/sqft = min), translate(-50%) would clip the start of
            // the label — switch to left-anchored. Mirror on the right.
            const PILL_HALF_WIDTH_EST = 60;
            const leftPx = PADDING.left + subjectX;
            const nearLeft = leftPx < PILL_HALF_WIDTH_EST + 8;
            const nearRight =
              width > 0 && leftPx > width - PILL_HALF_WIDTH_EST - 8;
            const xTransform = nearLeft
              ? "translate(0, -100%)"
              : nearRight
                ? "translate(-100%, -100%)"
                : "translate(-50%, -100%)";
            return (
              <div
                aria-hidden
                data-subject-pill-top
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: PADDING.top - 8,
                  transform: xTransform,
                  background: piq.indigo,
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.01em",
                  opacity: 0,
                  animation: `piq-fade-in 300ms ease ${overlayDelayS}s forwards`,
                }}
              >
                {formatValue(subjectPricePerSqft)}
                {unitLabel} · {subjectPillSubject}
              </div>
            );
          })()}

        {tooltip && (
          <CompsTooltip
            x={tooltip.x}
            y={tooltip.y}
            label={tooltip.label}
            sub={tooltip.sub}
          />
        )}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: piq.textMuted,
          marginTop: 8,
          opacity: 0,
          animation: `piq-fade-in 300ms ease ${overlayDelayS}s forwards`,
        }}
      >
        Subject property is in the{" "}
        <span
          style={{
            color: piq.textPrimary,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {ordinal(percentile)} percentile
        </span>{" "}
        of {comps.length} comparable sale{comps.length === 1 ? "" : "s"}.
      </div>
    </div>
  );
}
