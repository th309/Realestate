import { describe, it, expect } from "vitest";
import { extractMarketContextProps } from "../saved-render-builders";

/**
 * Covers the `ai` param threading added alongside the saved/shared AI
 * narrative wiring — `extractMarketContextProps` is the only place that
 * decides which persisted narrative (`market_context` vs `comps`) backs
 * `MarketContextSection`'s `aiText` prop on the snapshot read paths.
 */
describe("extractMarketContextProps aiText resolution", () => {
  const mc = { geo_level: "metro" as const, piq_score: { value: 68 } };

  it("prefers the market_context narrative when both are present", () => {
    const props = extractMarketContextProps(mc, {
      market_context: "Austin metro momentum is firming.",
      comps: "Comps narrative.",
    });
    expect(props.aiText).toBe("Austin metro momentum is firming.");
  });

  it("falls back to the comps narrative when market_context is absent", () => {
    const props = extractMarketContextProps(mc, {
      comps: "Comps narrative.",
    });
    expect(props.aiText).toBe("Comps narrative.");
  });

  it("resolves to null when no narratives are supplied", () => {
    const props = extractMarketContextProps(mc, {});
    expect(props.aiText).toBeNull();
  });

  it("resolves to null when the `ai` argument is omitted entirely", () => {
    const props = extractMarketContextProps(mc);
    expect(props.aiText).toBeNull();
  });

  it("always reports aiIsLoading=false (snapshot is already resolved)", () => {
    expect(extractMarketContextProps(mc, {}).aiIsLoading).toBe(false);
  });

  it("suppresses the geography chain (snapshot has no live parent chain)", () => {
    expect(extractMarketContextProps(mc, {}).chain).toBeNull();
  });
});
