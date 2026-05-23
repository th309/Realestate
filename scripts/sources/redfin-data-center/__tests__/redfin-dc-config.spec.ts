import {
  DASHBOARDS,
  getDashboard,
  S3_BASE,
  ALL_DASHBOARD_IDS,
} from "../redfin-dc-config";

describe("redfin-dc-config", () => {
  it("defines all 8 dashboards", () => {
    expect(ALL_DASHBOARD_IDS).toEqual([
      "price_drops",
      "contract_cancellations",
      "delistings_relistings",
      "housing_market",
      "investors",
      "cash_loan",
      "buyers_and_sellers",
      "rhpi",
    ]);
  });

  it("price_drops publishes 5 geos with table names + paths", () => {
    const d = getDashboard("price_drops");
    expect(Object.keys(d.geos).sort()).toEqual([
      "country",
      "county",
      "metro",
      "state",
      "zip",
    ]);
    expect(d.geos.metro.table).toBe("redfin_dc_price_drops_metro");
    expect(d.geos.metro.path).toBe("price_drops/monthly/all_metros.csv");
    expect(d.geos.country.path).toBe("price_drops/monthly/country.csv");
  });

  it("investors has by_category with category conflict key", () => {
    const d = getDashboard("investors");
    expect(d.geos.by_category.table).toBe("redfin_dc_investors_by_category");
    expect(d.geos.by_category.conflictKeys).toEqual([
      "period_end",
      "category_type",
      "category",
    ]);
  });

  it("buyers_and_sellers uses property_type in conflict key", () => {
    const d = getDashboard("buyers_and_sellers");
    expect(d.geos.metro.conflictKeys).toEqual([
      "period_end",
      "region_id",
      "property_type",
    ]);
  });

  it("buyers_and_sellers table names use the abbreviated buyers_sellers form", () => {
    const d = getDashboard("buyers_and_sellers");
    expect(d.geos.country.table).toBe("redfin_dc_buyers_sellers_country");
    expect(d.geos.census_region.table).toBe(
      "redfin_dc_buyers_sellers_census_region",
    );
    expect(d.geos.metro.table).toBe("redfin_dc_buyers_sellers_metro");
  });

  it("exposes a public S3 base for the new product", () => {
    expect(S3_BASE).toBe(
      "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center",
    );
  });
});
