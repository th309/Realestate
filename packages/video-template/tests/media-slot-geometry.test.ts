import { describe, it, expect } from "@jest/globals";
import { punchInGeometry, type FocusRegion } from "../src/media/media-slot";

// A 9:16 frame with a 16:9 screenshot in it — the product-demo case, and
// the one where getting the mapping wrong pushes the target off-screen.
const W = 1080;
const H = 1920;
const WIDE = 1600 / 900;

function centreOf(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe("punchInGeometry", () => {
  const region: FocusRegion = { x: 0.63, y: 0.2, w: 0.22, h: 0.16 };

  it("establishes on the whole asset, fully inside the frame", () => {
    const geo = punchInGeometry(region, 0, W, H, { sourceAspect: WIDE });
    const shownW = geo.scale * geo.boxWidth;
    const shownH = geo.scale * geo.boxHeight;
    expect(shownW).toBeLessThanOrEqual(W + 0.5);
    expect(shownH).toBeLessThanOrEqual(H + 0.5);
    // Centred, so a wide asset letterboxes evenly rather than hugging a edge.
    expect(geo.translateX + shownW / 2).toBeCloseTo(W / 2, 3);
    expect(geo.translateY + shownH / 2).toBeCloseTo(H / 2, 3);
  });

  it("lands the focus region dead centre when the move completes", () => {
    const geo = punchInGeometry(region, 1, W, H, { sourceAspect: WIDE });
    const c = centreOf(geo.regionOnScreen);
    expect(c.x).toBeCloseTo(W / 2, 3);
    expect(c.y).toBeCloseTo(H / 2, 3);
  });

  it("keeps the whole focus region on screen — never crops it", () => {
    const geo = punchInGeometry(region, 1, W, H, { sourceAspect: WIDE });
    const r = geo.regionOnScreen;
    expect(r.left).toBeGreaterThanOrEqual(-0.5);
    expect(r.top).toBeGreaterThanOrEqual(-0.5);
    expect(r.left + r.width).toBeLessThanOrEqual(W + 0.5);
    expect(r.top + r.height).toBeLessThanOrEqual(H + 0.5);
  });

  it("grows the region as large as the frame allows", () => {
    const geo = punchInGeometry(region, 1, W, H, { sourceAspect: WIDE });
    const r = geo.regionOnScreen;
    // Contained, so it touches one axis exactly.
    const touchesWidth = Math.abs(r.width - W) < 1;
    const touchesHeight = Math.abs(r.height - H) < 1;
    expect(touchesWidth || touchesHeight).toBe(true);
  });

  it("is a regression guard for the source-vs-frame coordinate bug", () => {
    // Authored against a 16:9 source, this region sits in the right-hand
    // third. Treating those coordinates as frame-relative (the original
    // bug) pushed it outside the visible crop entirely.
    const geo = punchInGeometry(region, 1, W, H, { sourceAspect: WIDE });
    const c = centreOf(geo.regionOnScreen);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(W);
    expect(c.y).toBeGreaterThan(0);
    expect(c.y).toBeLessThan(H);
  });

  it("moves monotonically inward — no drift back out mid-shot", () => {
    const scales = [0, 0.25, 0.5, 0.75, 1].map(
      (p) => punchInGeometry(region, p, W, H, { sourceAspect: WIDE }).scale,
    );
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
  });

  it("falls back to a gentle drift when no region is given", () => {
    const start = punchInGeometry(undefined, 0, W, H);
    const end = punchInGeometry(undefined, 1, W, H);
    expect(end.scale).toBeGreaterThan(start.scale);
    expect(end.scale / start.scale).toBeLessThan(1.15);
  });

  it("resolves slot URLs idempotently", async () => {
    // A caller may hand us a signed https link, a bare package-relative
    // path, or a path it already put through staticFile() (which returns a
    // root-relative path with no scheme). Only the bare one may be
    // resolved; doubling a prefix on the others silently 404s.
    const alreadyResolved = (url: string) =>
      /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/");

    expect(alreadyResolved("https://cdn.example.com/a.png")).toBe(true);
    expect(alreadyResolved("/test-fixtures/a.png")).toBe(true);
    expect(alreadyResolved("test-fixtures/a.png")).toBe(false);
  });

  it("treats the asset as frame-shaped when no aspect is supplied", () => {
    const geo = punchInGeometry(undefined, 0, W, H);
    expect(geo.boxWidth).toBe(W);
    expect(geo.boxHeight).toBe(H);
    expect(geo.scale).toBeCloseTo(1, 5);
  });
});
