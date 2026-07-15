import { describe, it, expect } from "vitest";
import { resolveTourPhase } from "../resolveTourPhase";

const market = { geoId: "12420", geoLevel: "metro", name: "Austin, TX" } as any;

describe("resolveTourPhase", () => {
  it("redirects vestigial step2 to step1 when a market is already set", () => {
    expect(
      resolveTourPhase({ phase: "step2", market, persona: "investor" as any }),
    ).toBe("step1");
  });

  it("redirects vestigial step3 to step1 when a market is already set", () => {
    expect(
      resolveTourPhase({ phase: "step3", market, persona: "investor" as any }),
    ).toBe("step1");
  });

  it("falls back to market collection for a step phase with no market", () => {
    expect(
      resolveTourPhase({
        phase: "step1",
        market: null,
        persona: "investor" as any,
      }),
    ).toBe("market");
  });

  it("falls back to persona when neither market nor persona is set", () => {
    expect(
      resolveTourPhase({ phase: "step1", market: null, persona: null }),
    ).toBe("persona");
  });

  it("passes non-step phases through unchanged", () => {
    expect(
      resolveTourPhase({
        phase: "celebrate",
        market,
        persona: "investor" as any,
      }),
    ).toBe("celebrate");
  });
});
