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
  dom: 40,
  priceCutPct: 10,
  valueYoyPct: 2,
  asOf: "2026-05-31",
});

describe("selectContrast", () => {
  it("picks the biggest 3-month faller as cooler and the highest scorer as riser", () => {
    const out = selectContrast([
      row("12420", "Austin, TX", 2, -7),
      row("34980", "Nashville, TN", 16, -24),
      row("15380", "Buffalo, NY", 96, 4),
      row("38300", "Pittsburgh, PA", 52, 12),
    ]);
    expect(out?.cooler.name).toBe("Nashville, TN"); // delta -24, biggest faller
    expect(out?.riser.name).toBe("Buffalo, NY"); // score 96, highest — not the +12 mover
    expect(out?.asOf).toBe("2026-05-31");
  });

  it("returns null with fewer than 2 valid rows", () => {
    expect(selectContrast([row("12420", "Austin, TX", 2, -7)])).toBeNull();
    expect(selectContrast([])).toBeNull();
  });

  it("never returns the same market on both sides", () => {
    const out = selectContrast([
      row("a", "Alpha", 40, -3),
      row("b", "Bravo", 50, -1),
    ]);
    expect(out).not.toBeNull();
    expect(out?.cooler.cbsa).not.toBe(out?.riser.cbsa);
    expect(out?.cooler.cbsa).toBe("a"); // -3 is the bigger fall
    expect(out?.riser.cbsa).toBe("b"); // 50 is the higher score
  });

  it("breaks faller ties by lower score, picks riser by highest score", () => {
    const out = selectContrast([
      row("90001", "Z", 30, -5),
      row("10001", "A", 70, -5),
      row("50000", "M", 50, 8),
    ]);
    // Both Z and A fall by 5; tiebreak picks the lower absolute score (30) as cooler.
    expect(out?.cooler.cbsa).toBe("90001");
    // Riser is the highest score (70), even though M had the biggest positive delta.
    expect(out?.riser.cbsa).toBe("10001");
  });
});
