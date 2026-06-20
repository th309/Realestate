import { selectContrast, type PoolRow } from "../hero-contrast";

const row = (
  cbsa: string,
  name: string,
  score: number,
  delta: number,
): PoolRow => ({
  cbsa,
  name,
  score,
  delta,
  direction: delta >= 0 ? "up" : "down",
  confidenceLevel: "A",
  asOf: "2026-05-31",
});

describe("selectContrast", () => {
  it("picks the biggest 3-month faller as cooler and biggest riser as riser", () => {
    const out = selectContrast([
      row("12420", "Austin, TX", 2, -7),
      row("34980", "Nashville, TN", 16, -24),
      row("15380", "Buffalo, NY", 96, 4),
      row("38300", "Pittsburgh, PA", 52, 12),
    ]);
    expect(out?.cooler.name).toBe("Nashville, TN"); // delta -24, the biggest faller
    expect(out?.riser.name).toBe("Pittsburgh, PA"); // delta +12, the biggest riser
    expect(out?.asOf).toBe("2026-05-31");
  });

  it("returns null with fewer than 2 valid rows", () => {
    expect(selectContrast([row("12420", "Austin, TX", 2, -7)])).toBeNull();
    expect(selectContrast([])).toBeNull();
  });

  it("never returns the same market on both sides", () => {
    // All falling — cooler and riser must still be distinct markets.
    const out = selectContrast([
      row("a", "Alpha", 40, -3),
      row("b", "Bravo", 50, -1),
    ]);
    expect(out).not.toBeNull();
    expect(out?.cooler.cbsa).not.toBe(out?.riser.cbsa);
    expect(out?.cooler.cbsa).toBe("a"); // -3 is the bigger fall
    expect(out?.riser.cbsa).toBe("b"); // -1 is the "biggest riser" of the two
  });

  it("breaks ties deterministically by score then cbsa", () => {
    const a = selectContrast([
      row("90001", "Z", 30, -5),
      row("10001", "A", 70, -5),
      row("50000", "M", 50, 8),
    ]);
    // Both fall by 5; tiebreak picks the lower absolute score (30) as cooler.
    expect(a?.cooler.cbsa).toBe("90001");
    expect(a?.riser.cbsa).toBe("50000");
  });
});
