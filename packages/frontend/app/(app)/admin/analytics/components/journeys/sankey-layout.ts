/**
 * Sankey geometry for the Navigation Flows panel.
 *
 * Hand-rolled rather than pulled from d3-sankey. d3 v7 is already a dependency
 * but d3-sankey is a separate plugin package and is not installed; the layout
 * below is ~120 lines of arithmetic, which is not worth a new dependency.
 *
 * WHY TWO COLUMNS AND NOT N: the backend returns unordered (from, to) pairs, not
 * sequenced journeys. A multi-column layout would have to infer a page ordering
 * that is not in the data — and web navigation is cyclic anyway (`/` → `/map`
 * and `/map` → `/` both exist), so there is no valid layering. Source column on
 * the left, destination column on the right, with a page free to appear in both.
 * That is exactly what the data says and nothing more.
 */

import { labelGutterFor } from "./sankey-labels";

export interface SankeyFlow {
  fromPage: string;
  toPage: string;
  transitions: number;
  visitors?: number;
}

export interface SankeyNode {
  id: string;
  path: string;
  side: "source" | "target";
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SankeyLink {
  id: string;
  fromPage: string;
  toPage: string;
  transitions: number;
  visitors?: number;
  /** Ribbon outline, ready for a <path d>. */
  d: string;
  thickness: number;
  sourceId: string;
  targetId: string;
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  width: number;
  height: number;
  totalTransitions: number;
  /** Horizontal gutter reserved for labels on each side. */
  labelGutter: number;
}

export interface SankeyLayoutOptions {
  width: number;
  /** Rendered thickness of a node bar. */
  nodeWidth?: number;
  /** Vertical gap between stacked nodes in a column. */
  nodePadding?: number;
  maxLinks?: number;
}

const NODE_WIDTH = 12;
const NODE_PADDING = 10;
const MAX_LINKS = 18;
/**
 * A ribbon below this many pixels is invisible and impossible to point at, so
 * thickness is floored here. Links above the floor stay exactly proportional;
 * node height is then DEFINED as the sum of its adjusted ribbons, which keeps
 * both ends of every ribbon aligned. See fitScale for who pays for the floor.
 */
const MIN_LINK_THICKNESS = 2;
const MIN_CHART_HEIGHT = 200;
const MAX_CHART_HEIGHT = 560;
/** Vertical room a node needs before its label stops colliding with the next. */
const HEIGHT_PER_NODE = 30;

function ribbonPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): string {
  const mid = (x0 + x1) / 2;
  return [
    `M${x0},${y0}`,
    `C${mid},${y0} ${mid},${y1} ${x1},${y1}`,
    `L${x1},${y1 + thickness}`,
    `C${mid},${y1 + thickness} ${mid},${y0 + thickness} ${x0},${y0 + thickness}`,
    "Z",
  ].join("");
}

interface Column {
  order: string[];
  totals: Map<string, number>;
}

function buildColumn(
  flows: SankeyFlow[],
  key: (flow: SankeyFlow) => string,
): Column {
  const totals = new Map<string, number>();
  for (const flow of flows) {
    totals.set(key(flow), (totals.get(key(flow)) ?? 0) + flow.transitions);
  }
  const order = Array.from(totals.keys()).sort(
    (a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b),
  );
  return { order, totals };
}

/**
 * Lay out the ribbons. Returns null when there is nothing to draw, so the
 * caller renders an empty state instead of a blank SVG.
 */
export function computeSankeyLayout(
  flows: SankeyFlow[],
  options: SankeyLayoutOptions,
): SankeyLayout | null {
  const {
    width,
    nodeWidth = NODE_WIDTH,
    nodePadding = NODE_PADDING,
    maxLinks = MAX_LINKS,
  } = options;

  const ranked = flows
    .filter((flow) => flow.transitions > 0)
    .sort((a, b) => b.transitions - a.transitions)
    .slice(0, maxLinks);

  if (ranked.length === 0 || width <= 0) return null;

  const sources = buildColumn(ranked, (f) => f.fromPage);
  const targets = buildColumn(ranked, (f) => f.toPage);
  const total = ranked.reduce((sum, f) => sum + f.transitions, 0);

  const tallestColumn = Math.max(sources.order.length, targets.order.length);
  const baseHeight = Math.max(
    MIN_CHART_HEIGHT,
    Math.min(MAX_CHART_HEIGHT, tallestColumn * HEIGHT_PER_NODE),
  );

  // One scale for both columns. Each column's totals sum to the same number —
  // every transition is counted once as an out-edge and once as an in-edge — so
  // a single scale makes each ribbon the same thickness at both of its ends.
  const paddingTotal = nodePadding * Math.max(0, tallestColumn - 1);
  const scale = total > 0 ? Math.max(0, baseHeight - paddingTotal) / total : 0;
  const thicknessOf = (transitions: number) =>
    Math.max(MIN_LINK_THICKNESS, transitions * scale);

  // `scale` budgets each ribbon its exact proportional share, but the floor then
  // lifts every sub-2px ribbon above that share — one dominant transition plus a
  // long tail, the usual shape of real navigation data, therefore stacks TALLER
  // than `baseHeight`, and the SVG is overflow-visible (so labels survive), so
  // the overrun would render straight through the legend below. Size the canvas
  // from post-floor totals instead: whatever is drawn defines the height. Beats
  // rescaling to fit, which shrinks honest above-floor ribbons to subsidise ones
  // that are only visible by fiat. Growth is capped at 2px per ribbon.
  const height = Math.max(
    baseHeight,
    ranked.reduce((sum, flow) => sum + thicknessOf(flow.transitions), 0) +
      paddingTotal,
  );

  const gutter = labelGutterFor(width);
  const sourceX = gutter;
  const targetX = Math.max(
    sourceX + nodeWidth + 40,
    width - gutter - nodeWidth,
  );

  const sourceIndex = new Map(sources.order.map((p, i) => [p, i]));
  const targetIndex = new Map(targets.order.map((p, i) => [p, i]));

  // Ribbons leave a source ordered by where they land, and arrive at a target
  // ordered by where they came from. That single pass is what stops the ribbons
  // crossing each other more than the data requires.
  const groupBy = (
    key: (flow: SankeyFlow) => string,
    rank: (flow: SankeyFlow) => number,
  ): Map<string, SankeyFlow[]> => {
    const grouped = new Map<string, SankeyFlow[]>();
    for (const flow of ranked) {
      const list = grouped.get(key(flow));
      if (list) list.push(flow);
      else grouped.set(key(flow), [flow]);
    }
    for (const list of grouped.values()) list.sort((a, b) => rank(a) - rank(b));
    return grouped;
  };

  const outgoing = groupBy(
    (f) => f.fromPage,
    (f) => targetIndex.get(f.toPage) ?? 0,
  );
  const incoming = groupBy(
    (f) => f.toPage,
    (f) => sourceIndex.get(f.fromPage) ?? 0,
  );

  /** Stack a column, deriving each node's height from its own ribbons. */
  function layoutColumn(
    order: string[],
    totals: Map<string, number>,
    grouped: Map<string, SankeyFlow[]>,
    side: "source" | "target",
    x: number,
  ): { nodes: SankeyNode[]; offsets: Map<string, number> } {
    const heights = order.map((path) =>
      (grouped.get(path) ?? []).reduce(
        (sum, flow) => sum + thicknessOf(flow.transitions),
        0,
      ),
    );
    const stackHeight =
      heights.reduce((a, b) => a + b, 0) +
      nodePadding * Math.max(0, order.length - 1);
    let cursor = Math.max(0, (height - stackHeight) / 2);

    const nodes: SankeyNode[] = [];
    const offsets = new Map<string, number>();
    order.forEach((path, i) => {
      nodes.push({
        id: `${side}:${path}`,
        path,
        side,
        value: totals.get(path) ?? 0,
        x,
        y: cursor,
        width: nodeWidth,
        height: heights[i],
      });
      offsets.set(path, cursor);
      cursor += heights[i] + nodePadding;
    });
    return { nodes, offsets };
  }

  const left = layoutColumn(
    sources.order,
    sources.totals,
    outgoing,
    "source",
    sourceX,
  );
  const right = layoutColumn(
    targets.order,
    targets.totals,
    incoming,
    "target",
    targetX,
  );

  const sourceCursor = new Map(left.offsets);
  const targetCursor = new Map(right.offsets);
  const links: SankeyLink[] = [];

  // Emit in column order so ribbons stack against the same offsets the nodes
  // were measured with.
  for (const path of sources.order) {
    for (const flow of outgoing.get(path) ?? []) {
      const thickness = thicknessOf(flow.transitions);
      const y0 = sourceCursor.get(flow.fromPage) ?? 0;
      const y1 = targetCursor.get(flow.toPage) ?? 0;
      sourceCursor.set(flow.fromPage, y0 + thickness);
      targetCursor.set(flow.toPage, y1 + thickness);

      links.push({
        id: `${flow.fromPage}→${flow.toPage}`,
        fromPage: flow.fromPage,
        toPage: flow.toPage,
        transitions: flow.transitions,
        visitors: flow.visitors,
        thickness,
        sourceId: `source:${flow.fromPage}`,
        targetId: `target:${flow.toPage}`,
        d: ribbonPath(sourceX + nodeWidth, y0, targetX, y1, thickness),
      });
    }
  }

  return {
    nodes: [...left.nodes, ...right.nodes],
    links,
    width,
    height,
    totalTransitions: total,
    labelGutter: gutter,
  };
}
