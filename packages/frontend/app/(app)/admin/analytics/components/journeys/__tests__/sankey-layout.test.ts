/**
 * Sankey geometry.
 *
 * A layout bug here is silent: the SVG still renders, the types still check, and
 * the ribbons are simply wrong — misaligned ends, thicknesses that do not track
 * the counts, nodes overlapping. These assert the invariants that make the
 * picture mean what it claims.
 *
 * Fixture is the real top-of-window shape from analytics_navigation_flows, which
 * includes the cycle (`/` → `/map` AND `/map` → `/`) that rules out any
 * multi-column layering.
 */

import { describe, it, expect } from "vitest";
import { computeSankeyLayout, type SankeyFlow } from "../sankey-layout";
import { labelCharBudget, truncateMiddle } from "../sankey-labels";

const FLOWS: SankeyFlow[] = [
  { fromPage: "/", toPage: "/map", transitions: 21, visitors: 17 },
  { fromPage: "/", toPage: "/auth/sign-up", transitions: 12, visitors: 10 },
  { fromPage: "/map", toPage: "/analyzer", transitions: 10, visitors: 6 },
  { fromPage: "/map", toPage: "/market", transitions: 10, visitors: 5 },
  { fromPage: "/", toPage: "/reports", transitions: 9, visitors: 9 },
  { fromPage: "/reports", toPage: "/analyzer", transitions: 9, visitors: 8 },
  { fromPage: "/map", toPage: "/", transitions: 9, visitors: 9 },
  { fromPage: "/", toPage: "/pricing", transitions: 8, visitors: 8 },
];

const WIDTH = 720;

describe("computeSankeyLayout", () => {
  it("returns null instead of an empty SVG when there is nothing to draw", () => {
    expect(computeSankeyLayout([], { width: WIDTH })).toBeNull();
    expect(computeSankeyLayout(FLOWS, { width: 0 })).toBeNull();
    expect(
      computeSankeyLayout([{ fromPage: "/a", toPage: "/b", transitions: 0 }], {
        width: WIDTH,
      }),
    ).toBeNull();
  });

  it("places a page in both columns when it is both a source and a target", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;
    const mapNodes = layout.nodes.filter((n) => n.path === "/map");

    expect(mapNodes.map((n) => n.side).sort()).toEqual(["source", "target"]);
    // The cycle is why: /map is departed from AND arrived at.
    expect(
      layout.links.some((l) => l.fromPage === "/" && l.toPage === "/map"),
    ).toBe(true);
    expect(
      layout.links.some((l) => l.fromPage === "/map" && l.toPage === "/"),
    ).toBe(true);
  });

  it("makes ribbon thickness proportional to the transition count", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;
    const big = layout.links.find((l) => l.transitions === 21)!;
    const small = layout.links.find((l) => l.transitions === 8)!;

    expect(big.thickness / small.thickness).toBeCloseTo(21 / 8, 5);
  });

  it("gives every node a height equal to the ribbons meeting it, so both ends align", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;

    for (const node of layout.nodes) {
      const attached = layout.links.filter((link) =>
        node.side === "source"
          ? link.sourceId === node.id
          : link.targetId === node.id,
      );
      expect(attached.length).toBeGreaterThan(0);
      const stacked = attached.reduce((sum, l) => sum + l.thickness, 0);
      expect(node.height).toBeCloseTo(stacked, 6);
    }
  });

  it("stacks nodes within a column without overlapping", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;

    for (const side of ["source", "target"] as const) {
      const column = layout.nodes
        .filter((n) => n.side === side)
        .sort((a, b) => a.y - b.y);

      expect(column.length).toBeGreaterThan(1);
      for (let i = 1; i < column.length; i++) {
        expect(column[i].y).toBeGreaterThanOrEqual(
          column[i - 1].y + column[i - 1].height,
        );
      }
      // Every column shares one x, and sources sit left of targets.
      expect(new Set(column.map((n) => n.x)).size).toBe(1);
    }

    const sourceX = layout.nodes.find((n) => n.side === "source")!.x;
    const targetX = layout.nodes.find((n) => n.side === "target")!.x;
    expect(sourceX).toBeLessThan(targetX);
  });

  it("orders each column by volume, biggest first", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;
    const sources = layout.nodes
      .filter((n) => n.side === "source")
      .sort((a, b) => a.y - b.y);

    expect(sources[0].path).toBe("/");
    // "/" is the source of 21 + 12 + 9 + 8 transitions.
    expect(sources[0].value).toBe(50);
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i - 1].value).toBeGreaterThanOrEqual(sources[i].value);
    }
  });

  it("keeps every node and ribbon inside the reported canvas", () => {
    const layout = computeSankeyLayout(FLOWS, { width: WIDTH })!;

    for (const node of layout.nodes) {
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height + 0.001);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
    }
    for (const link of layout.links) {
      expect(link.d).not.toMatch(/NaN|Infinity/);
    }
    expect(layout.totalTransitions).toBe(88);
  });

  it("survives a narrow viewport with the columns still separated", () => {
    const layout = computeSankeyLayout(FLOWS, { width: 320 })!;

    expect(layout.labelGutter).toBeGreaterThanOrEqual(64);
    const sourceNode = layout.nodes.find((n) => n.side === "source")!;
    const targetNode = layout.nodes.find((n) => n.side === "target")!;
    expect(targetNode.x).toBeGreaterThan(sourceNode.x + sourceNode.width);
    for (const link of layout.links) {
      expect(link.d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("caps how many ribbons it will draw", () => {
    const many: SankeyFlow[] = Array.from({ length: 60 }, (_, i) => ({
      fromPage: `/from-${i}`,
      toPage: `/to-${i}`,
      transitions: 60 - i,
    }));
    const layout = computeSankeyLayout(many, { width: WIDTH, maxLinks: 12 })!;

    expect(layout.links).toHaveLength(12);
    // It keeps the biggest, not the first twelve it happened to be handed.
    expect(Math.min(...layout.links.map((l) => l.transitions))).toBe(49);
  });

  it("floors sub-pixel ribbons so a rare transition stays visible and clickable", () => {
    const lopsided: SankeyFlow[] = [
      { fromPage: "/", toPage: "/map", transitions: 50000 },
      { fromPage: "/", toPage: "/rare", transitions: 1 },
    ];
    const layout = computeSankeyLayout(lopsided, { width: WIDTH })!;
    const rare = layout.links.find((l) => l.toPage === "/rare")!;

    expect(rare.thickness).toBeGreaterThanOrEqual(2);
    // The floor must not break the alignment invariant.
    const source = layout.nodes.find((n) => n.side === "source")!;
    expect(source.height).toBeCloseTo(
      layout.links.reduce((sum, l) => sum + l.thickness, 0),
      6,
    );
  });

  it("keeps a skewed distribution inside the canvas rather than overflowing it", () => {
    // One dominant transition plus a long tail of sub-pixel ones — the real
    // shape of ~596 flow pairs over 30 days. Every tail ribbon gets lifted to
    // the 2px floor, so a scale solved BEFORE flooring hands out more vertical
    // space than the chart owns and the stack runs off the bottom. The SVG is
    // `overflow-visible`, so nothing clips it back: it lands on the legend.
    const skewed: SankeyFlow[] = [
      { fromPage: "/", toPage: "/map", transitions: 100_000 },
      ...Array.from({ length: 17 }, (_, i) => ({
        fromPage: "/",
        toPage: `/tail-${i}`,
        transitions: 1,
      })),
    ];
    const layout = computeSankeyLayout(skewed, { width: WIDTH })!;

    // Guard the fixture itself: the tail has to actually be sitting on the
    // floor, or this asserts nothing.
    expect(layout.links).toHaveLength(18);
    expect(layout.links.filter((l) => l.thickness === 2)).toHaveLength(17);

    for (const side of ["source", "target"] as const) {
      const column = layout.nodes.filter((n) => n.side === side);
      const top = Math.min(...column.map((n) => n.y));
      const bottom = Math.max(...column.map((n) => n.y + n.height));

      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(layout.height + 0.001);
      expect(bottom - top).toBeLessThanOrEqual(layout.height + 0.001);
    }
  });
});

describe("label truncation", () => {
  it("keeps the distinguishing tail of a long path", () => {
    const a = truncateMiddle("/markets/metro/austin-tx", 16);
    const b = truncateMiddle("/markets/metro/boston-ma", 16);

    expect(a).toContain("…");
    expect(a).toHaveLength(16);
    // Trailing truncation would render both as the same string.
    expect(a).not.toEqual(b);
    expect(a.endsWith("tin-tx")).toBe(true);
  });

  it("leaves short paths alone", () => {
    expect(truncateMiddle("/map", 16)).toBe("/map");
  });

  it("scales the character budget with the gutter", () => {
    expect(labelCharBudget(150)).toBeGreaterThan(labelCharBudget(64));
    expect(labelCharBudget(0)).toBeGreaterThanOrEqual(6);
  });
});
