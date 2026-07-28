import {
  computeFocusRegion,
  type FocusMeasurement,
} from '../site-capture-geometry';

/** A 1920x1080 viewport scrolled 400px down a 1920x3000 document. */
function measurement(
  rect: FocusMeasurement['rect'],
  overrides: Partial<FocusMeasurement> = {},
): FocusMeasurement {
  return {
    rect,
    scrollX: 0,
    scrollY: 400,
    viewportWidth: 1920,
    viewportHeight: 1080,
    documentWidth: 1920,
    documentHeight: 3000,
    ...overrides,
  };
}

describe('computeFocusRegion normalizes an element box against the captured image', () => {
  it('divides a viewport-shot box by the viewport, ignoring scroll offset', () => {
    // getBoundingClientRect() is already viewport-relative, and a viewport
    // screenshot's origin IS the viewport — so scrollY must NOT be added.
    const result = computeFocusRegion(
      measurement({ x: 480, y: 270, width: 960, height: 540 }),
      false,
    );

    expect(result).not.toBeNull();
    expect(result!.region).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(result!.clipped).toBe(false);
  });

  it('adds scroll back in and divides by the document for a full-page shot', () => {
    // Same element, same scroll position. A full-page image's origin is the
    // document, so y becomes (270 + 400) / 3000 — a different answer to the
    // viewport case above, which is the whole point of the distinction.
    const result = computeFocusRegion(
      measurement({ x: 480, y: 270, width: 960, height: 540 }),
      true,
    );

    expect(result).not.toBeNull();
    expect(result!.region.x).toBeCloseTo(480 / 1920, 10);
    expect(result!.region.y).toBeCloseTo(670 / 3000, 10);
    expect(result!.region.w).toBeCloseTo(960 / 1920, 10);
    expect(result!.region.h).toBeCloseTo(540 / 3000, 10);
    expect(result!.clipped).toBe(false);
  });

  it('accounts for horizontal scroll on a full-page shot', () => {
    const result = computeFocusRegion(
      measurement(
        { x: 100, y: 0, width: 200, height: 100 },
        {
          scrollX: 300,
          scrollY: 0,
          documentWidth: 4000,
        },
      ),
      true,
    );

    expect(result!.region.x).toBeCloseTo(400 / 4000, 10);
    expect(result!.region.w).toBeCloseTo(200 / 4000, 10);
  });

  it('produces coordinates that always stay within 0..1', () => {
    const result = computeFocusRegion(
      measurement({ x: -200, y: -100, width: 3000, height: 2000 }),
      false,
    );

    const { x, y, w, h } = result!.region;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(1);
    expect(y + h).toBeLessThanOrEqual(1);
  });

  it('clips an element that overhangs the frame edge and flags it', () => {
    // Half of a 960-wide element hangs off the right edge of a 1920 viewport.
    const result = computeFocusRegion(
      measurement({ x: 1440, y: 0, width: 960, height: 540 }),
      false,
    );

    expect(result!.region).toEqual({ x: 0.75, y: 0, w: 0.25, h: 0.5 });
    expect(result!.clipped).toBe(true);
  });

  it('returns null when the element sits entirely outside the frame', () => {
    // Scrolled past: rect.y is beyond the bottom of the viewport.
    expect(
      computeFocusRegion(
        measurement({ x: 0, y: 2000, width: 400, height: 200 }),
        false,
      ),
    ).toBeNull();

    // And off to the left.
    expect(
      computeFocusRegion(
        measurement({ x: -500, y: 0, width: 400, height: 200 }),
        false,
      ),
    ).toBeNull();
  });

  it("returns null for a region below the renderer's 0.01 minimum extent", () => {
    // FocusRegionSchema in packages/video-template/src/media/media-slot.ts
    // bounds w/h at min(0.01); anything thinner must fail here, with route and
    // selector context, rather than as a Zod error inside the render.
    expect(
      computeFocusRegion(
        // 9px wide in a 1920 frame = 0.0047.
        measurement({ x: 100, y: 100, width: 9, height: 200 }),
        false,
      ),
    ).toBeNull();

    expect(
      computeFocusRegion(
        // 10px tall in a 1080 frame = 0.0093.
        measurement({ x: 100, y: 100, width: 400, height: 10 }),
        false,
      ),
    ).toBeNull();

    // Just above the bound still passes.
    const ok = computeFocusRegion(
      measurement({ x: 100, y: 100, width: 20, height: 12 }),
      false,
    );
    expect(ok).not.toBeNull();
    expect(ok!.region.w).toBeGreaterThanOrEqual(0.01);
    expect(ok!.region.h).toBeGreaterThanOrEqual(0.01);
  });

  it('never emits a region the renderer schema would reject', () => {
    const result = computeFocusRegion(
      measurement({ x: -200, y: -100, width: 3000, height: 2000 }),
      false,
    );

    // Mirrors FocusRegionSchema's bounds: x/y in [0,1], w/h in [0.01,1].
    const { x, y, w, h } = result!.region;
    for (const value of [x, y]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (const value of [w, h]) {
      expect(value).toBeGreaterThanOrEqual(0.01);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('returns null for a zero-area element or a collapsed frame', () => {
    expect(
      computeFocusRegion(
        measurement({ x: 100, y: 100, width: 0, height: 200 }),
        false,
      ),
    ).toBeNull();

    expect(
      computeFocusRegion(
        measurement(
          { x: 10, y: 10, width: 100, height: 100 },
          {
            viewportWidth: 0,
          },
        ),
        false,
      ),
    ).toBeNull();
  });
});
