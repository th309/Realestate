import { describe, expect, it } from "vitest";
import { MARKET_ERAS, eraForMonth, eraTickIndices } from "../market-eras";

describe("MARKET_ERAS", () => {
  it("periods never overlap and are chronologically ordered", () => {
    for (let i = 1; i < MARKET_ERAS.length; i++) {
      const prev = MARKET_ERAS[i - 1];
      const curr = MARKET_ERAS[i];
      expect(prev.to).not.toBeNull(); // only the final era is open-ended
      expect(prev.to! < curr.from).toBe(true);
    }
    expect(MARKET_ERAS[MARKET_ERAS.length - 1].to).toBeNull();
  });
});

describe("eraForMonth", () => {
  it("finds the financial crisis for early 2009", () => {
    expect(eraForMonth("2009-01-31")?.label).toBe("Global financial crisis");
  });

  it("returns null for a month between eras", () => {
    expect(eraForMonth("2003-05-31")).toBeNull();
  });

  it("treats era boundaries as inclusive", () => {
    expect(eraForMonth("2007-12-31")?.label).toBe("Global financial crisis");
    expect(eraForMonth("2009-06-30")?.label).toBe("Global financial crisis");
  });

  it("maps today into the open-ended cooldown era", () => {
    expect(eraForMonth("2026-05-31")?.label).toBe("High-rate cooldown");
  });
});

describe("eraTickIndices", () => {
  it("maps each era start to the first month at or after it", () => {
    const months = ["2007-11-30", "2007-12-31", "2008-01-31"];
    const ticks = eraTickIndices(months);
    const gfc = ticks.find((t) => t.label === "Global financial crisis");
    expect(gfc?.index).toBe(1);
  });

  it("drops eras that start after the last month", () => {
    const months = ["2001-03-31", "2001-04-30"];
    const ticks = eraTickIndices(months);
    expect(ticks).toHaveLength(1); // only the dot-com era falls in range
  });

  it("collapses colliding eras at the same index, keeping the latest era's label", () => {
    // Dot-com recession (2001-03) and Housing boom peak (2004-01) both
    // precede the first month, so both resolve to index 0 — the truncated
    // array must produce ONE tick there, not two stacked on top of each other.
    const months = ["2007-11-30", "2007-12-31", "2008-01-31"];
    const ticks = eraTickIndices(months);
    const atIndexZero = ticks.filter((t) => t.index === 0);
    expect(atIndexZero).toHaveLength(1);
    expect(atIndexZero[0].label).toBe("Housing boom peak");
  });
});
