import { describe, it, expect } from "vitest";
import { mergeScopeResponses } from "../useExplorerScopeData";

const mk = (
  dates: string[],
  series: Record<string, (number | null)[]>,
  regions: any[] = [],
) =>
  ({
    success: true,
    geoLevel: "metro",
    metric: "x",
    months: dates.length,
    dates,
    regions,
    series,
  }) as any;

describe("mergeScopeResponses", () => {
  it("realigns metrics with different date ranges onto one union axis", () => {
    const entries = [
      {
        metric: "home_value",
        resp: mk(["2026-04-01", "2026-05-01"], { A: [100, 110] }, [
          { id: "A", name: "A", state: "X", population: 1 },
        ]),
      },
      { metric: "hotness_score", resp: mk(["2026-05-01"], { A: [70] }) },
    ];
    const { dates, series, regions } = mergeScopeResponses(entries);
    expect(dates).toEqual(["2026-04-01", "2026-05-01"]);
    expect(series.home_value.A).toEqual([100, 110]);
    expect(series.hotness_score.A).toEqual([null, 70]); // shorter series padded at the front
    expect(regions[0].id).toBe("A");
  });

  it("returns empty structures when nothing has loaded", () => {
    expect(
      mergeScopeResponses([{ metric: "home_value", resp: undefined }]),
    ).toEqual({
      dates: [],
      regions: [],
      series: {},
    });
  });
});
