/**
 * NavigationSankey
 *
 * SVG Sankey of page-to-page navigation. Nodes are pages, links are
 * transitions, ribbon thickness is proportional to the transition count.
 *
 * Left column is the page departed from, right column the page arrived at, and
 * a page can appear in both — the backend returns unordered (from, to) pairs,
 * not sequenced journeys, so any deeper layering would be invented. See
 * sankey-layout.ts.
 *
 * No charting dependency: d3 is available but d3-sankey is a separate,
 * uninstalled plugin, and the geometry is small enough not to warrant one.
 * Colours are semantic M3 tokens only, so the diagram inverts correctly in dark
 * mode without a single hardcoded hex (CLAUDE.md 8.2).
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigationFlow } from "@/lib/data/fetchers/admin-analytics.types";
import { computeSankeyLayout, type SankeyLink } from "./sankey-layout";
import { labelCharBudget, truncateMiddle } from "./sankey-labels";

interface NavigationSankeyProps {
  flows: NavigationFlow[];
  onDrillDown?: (key: string, value: string) => void;
}

/** ResizeObserver-backed width tracker, so the diagram lays out in real pixels
 *  and label text stays a constant readable size instead of scaling with a
 *  viewBox. */
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function describeLink(link: SankeyLink, share: string): string {
  const visitors =
    link.visitors != null
      ? `, ${link.visitors.toLocaleString()} ${link.visitors === 1 ? "visitor" : "visitors"}`
      : "";
  return `${link.fromPage} to ${link.toPage}: ${link.transitions.toLocaleString()} transitions${visitors} (${share}% of shown flow)`;
}

export function NavigationSankey({
  flows,
  onDrillDown,
}: NavigationSankeyProps) {
  const { ref, width } = useContainerWidth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const layout = useMemo(
    () => computeSankeyLayout(flows, { width }),
    [flows, width],
  );

  // Measured before the first paint: render the container so the observer can
  // report a width, but nothing inside it yet.
  if (width === 0) {
    return (
      <div ref={ref} className="min-h-[220px] w-full" aria-hidden="true" />
    );
  }

  if (!layout) {
    return (
      <div ref={ref} className="w-full">
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium text-on-surface">
            No navigation flows in this period
          </p>
          <p className="max-w-md text-xs text-on-surface-variant">
            A flow needs two consecutive pageviews in one session. Try a longer
            window, or a broader traffic segment.
          </p>
        </div>
      </div>
    );
  }

  const charBudget = labelCharBudget(layout.labelGutter);
  const activeLink = layout.links.find((link) => link.id === activeId) ?? null;
  const shareOf = (transitions: number) =>
    layout.totalTransitions > 0
      ? ((transitions / layout.totalTransitions) * 100).toFixed(1)
      : "0.0";

  const isDimmed = (link: SankeyLink) =>
    activeId !== null && activeId !== link.id;
  const nodeIsActive = (nodeId: string) =>
    activeLink != null &&
    (activeLink.sourceId === nodeId || activeLink.targetId === nodeId);

  return (
    <div ref={ref} className="w-full">
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full overflow-visible"
        role="group"
        aria-label={`Sankey diagram of ${layout.links.length} page transitions`}
      >
        <g onMouseLeave={() => setActiveId(null)}>
          {layout.links.map((link) => (
            <path
              key={link.id}
              d={link.d}
              tabIndex={0}
              role="button"
              aria-label={describeLink(link, shareOf(link.transitions))}
              fill="var(--color-primary)"
              fillOpacity={
                activeId === link.id ? 0.62 : isDimmed(link) ? 0.1 : 0.28
              }
              strokeLinejoin="round"
              // The dashboard's focus ring is `focus:outline-none` +
              // `focus-visible:ring-2 focus-visible:ring-primary`; an SVG <path>
              // takes no ring utility, so the equivalent here is a 2px stroke
              // traced round the ribbon outline. It has to be a SHAPE change,
              // not the old fill swap: a ribbon can be 2px thin, and with 18 of
              // them a recolour alone is both unfollowable and colour-only
              // (WCAG 1.4.1). `on-surface` is the one token defined to contrast
              // with the surface in BOTH themes, so the outline reads dark on
              // light and light on dark. Ribbons that are not focused drop to
              // 0.1 fill opacity, which keeps the outline legible on top.
              className="cursor-pointer transition-[fill-opacity] duration-200 focus:outline-none focus-visible:fill-[var(--color-tertiary)] focus-visible:stroke-on-surface focus-visible:stroke-2"
              onMouseEnter={() => setActiveId(link.id)}
              onFocus={() => setActiveId(link.id)}
              onBlur={() => setActiveId(null)}
              onClick={() => onDrillDown?.("fromPage", link.fromPage)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onDrillDown?.("fromPage", link.fromPage);
                }
              }}
            >
              <title>{describeLink(link, shareOf(link.transitions))}</title>
            </path>
          ))}
        </g>

        {layout.nodes.map((node) => {
          const isSource = node.side === "source";
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={Math.max(node.height, 2)}
                rx={3}
                fill={
                  isSource ? "var(--color-primary)" : "var(--color-tertiary)"
                }
                fillOpacity={nodeIsActive(node.id) ? 1 : 0.85}
                className="transition-[fill-opacity] duration-200"
              >
                <title>{`${node.path} — ${node.value.toLocaleString()} transitions ${isSource ? "out" : "in"}`}</title>
              </rect>
              <text
                x={isSource ? node.x - 8 : node.x + node.width + 8}
                y={node.y + Math.max(node.height, 2) / 2}
                textAnchor={isSource ? "end" : "start"}
                dominantBaseline="central"
                className="pointer-events-none select-none font-mono text-[10px]"
                fill={
                  nodeIsActive(node.id)
                    ? "var(--color-on-surface)"
                    : "var(--color-on-surface-variant)"
                }
              >
                {truncateMiddle(node.path, charBudget)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-outline-variant/50 pt-3">
        <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm bg-primary"
            />
            From page
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm bg-tertiary"
            />
            To page
          </span>
        </div>

        {/* Doubles as the hover readout and the screen-reader announcement, so
            the full untruncated paths are reachable by keyboard alone. */}
        <p
          role="status"
          aria-live="polite"
          className="min-h-[1rem] flex-1 text-right font-mono text-[11px] text-on-surface"
        >
          {activeLink ? (
            <>
              <span className="text-on-surface-variant">
                {activeLink.fromPage}
              </span>
              <span aria-hidden="true" className="px-1.5">
                →
              </span>
              <span className="text-on-surface-variant">
                {activeLink.toPage}
              </span>
              <span className="pl-2 tabular-nums">
                {activeLink.transitions.toLocaleString()}
                {activeLink.visitors != null
                  ? ` · ${activeLink.visitors.toLocaleString()} visitors`
                  : ""}
              </span>
            </>
          ) : (
            <span className="text-on-surface-variant">
              Hover or tab a ribbon for the full path.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
