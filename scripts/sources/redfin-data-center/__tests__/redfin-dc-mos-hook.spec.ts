import { buildMosRows } from "../redfin-dc-mos-hook";

describe("buildMosRows", () => {
  it("computes MoS and skips zero/null homes or missing active listings", () => {
    const hm = [
      {
        region_id: "35620",
        period_end: "2026-04-30",
        active_listings: 3000,
        homes_sold: 1000,
      },
      {
        region_id: "16980",
        period_end: "2026-04-30",
        active_listings: 2000,
        homes_sold: 0,
      },
      {
        region_id: "31080",
        period_end: "2026-04-30",
        active_listings: null,
        homes_sold: 500,
      },
    ];
    const rows = buildMosRows(hm as any, "metro");
    expect(rows).toEqual([
      {
        geography_id: "35620",
        geography_type: "metro",
        period_date: "2026-04-30",
        months_of_supply: 3,
      },
    ]);
  });

  it("aggregates metro DIVISIONS sharing one CBSA before dividing", () => {
    // LA + Anaheim divisions both region_id 31080: sum listings/sales, then divide.
    const hm = [
      {
        region_id: "31080",
        period_end: "2026-04-30",
        active_listings: 9000,
        homes_sold: 2000,
      },
      {
        region_id: "31080",
        period_end: "2026-04-30",
        active_listings: 3000,
        homes_sold: 1000,
      },
    ];
    const rows = buildMosRows(hm as any, "metro");
    // (9000 + 3000) / (2000 + 1000) = 4.0  — NOT averaged per-row
    expect(rows).toEqual([
      {
        geography_id: "31080",
        geography_type: "metro",
        period_date: "2026-04-30",
        months_of_supply: 4,
      },
    ]);
  });

  it("keeps separate periods/regions distinct", () => {
    const hm = [
      {
        region_id: "06037",
        period_end: "2026-03-31",
        active_listings: 1000,
        homes_sold: 500,
      },
      {
        region_id: "06037",
        period_end: "2026-04-30",
        active_listings: 1200,
        homes_sold: 400,
      },
    ];
    const rows = buildMosRows(hm as any, "county");
    expect(rows).toHaveLength(2);
    expect(
      rows.find((r) => r.period_date === "2026-03-31")!.months_of_supply,
    ).toBe(2);
    expect(
      rows.find((r) => r.period_date === "2026-04-30")!.months_of_supply,
    ).toBe(3);
  });
});
