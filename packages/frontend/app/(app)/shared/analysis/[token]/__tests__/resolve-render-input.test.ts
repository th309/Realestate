import { describe, it, expect } from "vitest";
import { resolveRenderInput } from "../resolve-render-input";

/**
 * The public share page and the PDF are client-facing output, and this is
 * the seam where they get their numbers.
 *
 * `input_snapshot` was repurposed to hold a versioned `DealStateV2` that
 * NESTS the DealInput under `.input`. The readonly view's fallback used to
 * pass that column straight through to components that read `price` /
 * `rentMonthly` / `financing` off the top level — which does not crash, it
 * renders a report full of blanks and zeros for a client. Hence unwrapping,
 * and hence pinning it: this directory has no other tests.
 */
describe("resolveRenderInput", () => {
  const flatInput = {
    price: 300000,
    rentMonthly: 2400,
    financing: { downPaymentPct: 0.2 },
  };

  it("prefers the frozen artifact's flat input", () => {
    expect(resolveRenderInput(flatInput, { v: 2, input: { price: 1 } })).toBe(
      flatInput,
    );
  });

  it("unwraps a v2 envelope when the artifact has no input echo", () => {
    const row = {
      v: 2,
      input: flatInput,
      label: "Duplex on 5th",
      analysisMode: "compare",
      notes: "private",
    };
    expect(resolveRenderInput(undefined, row)).toEqual(flatInput);
  });

  it("never hands the envelope itself to a renderer", () => {
    const resolved = resolveRenderInput(undefined, {
      v: 2,
      input: flatInput,
      notes: "private",
    });
    // The bug's signature: the envelope has no `price`, so every figure on
    // the cover table renders empty while `notes` leaks into scope.
    expect(resolved).not.toHaveProperty("notes");
    expect(resolved?.price).toBe(300000);
  });

  it("passes a legacy v1 row through untouched — it IS the DealInput", () => {
    expect(resolveRenderInput(undefined, flatInput)).toBe(flatInput);
  });

  it("resolves null rather than a misleading shape for a missing row", () => {
    expect(resolveRenderInput(undefined, null)).toBeNull();
    expect(resolveRenderInput(undefined, undefined)).toBeNull();
  });

  it("resolves null for a v2 envelope whose input is missing or malformed", () => {
    expect(resolveRenderInput(undefined, { v: 2 })).toBeNull();
    expect(resolveRenderInput(undefined, { v: 2, input: null })).toBeNull();
    expect(resolveRenderInput(undefined, { v: 2, input: [1, 2] })).toBeNull();
  });

  it("treats an unrecognised version as legacy rather than dropping the data", () => {
    // A future v3 envelope should not silently render as blanks here; it
    // falls through to the legacy branch, which is what the v1 rows in the
    // table need. Revisit when a v3 actually ships.
    const v3 = { v: 3, price: 250000 };
    expect(resolveRenderInput(undefined, v3)).toBe(v3);
  });
});
