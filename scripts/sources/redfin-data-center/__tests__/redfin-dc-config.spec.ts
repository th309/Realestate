import {
  DASHBOARDS,
  getDashboard,
  getKnownColumns,
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

  it("buyers_and_sellers metro key has region_name AND property_type", () => {
    const d = getDashboard("buyers_and_sellers");
    expect(d.geos.metro.conflictKeys).toEqual([
      "period_end",
      "region_id",
      "region_name",
      "property_type",
    ]);
  });

  it("metro conflict keys include region_name (division disambiguation)", () => {
    for (const id of ["price_drops", "investors", "cash_loan", "rhpi"]) {
      const d = getDashboard(id);
      expect(d.geos.metro.conflictKeys).toContain("region_name");
    }
    // non-metro geos keep the plain (period_end, region_id) key
    expect(getDashboard("price_drops").geos.county.conflictKeys).toEqual([
      "period_end",
      "region_id",
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

  it("getKnownColumns = meta + metric columns + target textDims", () => {
    const d = getDashboard("price_drops");
    const cols = getKnownColumns(d, d.geos.metro);
    // standard metadata
    expect(cols.has("region_id")).toBe(true);
    expect(cols.has("period_end")).toBe(true);
    // a price_drops metric
    expect(cols.has("percent_active_with_price_drops_yoy")).toBe(true);
    // not a column from another dashboard
    expect(cols.has("buyer_seller_ratio")).toBe(false);
  });

  it("getKnownColumns includes textDims for targets that declare them", () => {
    const d = getDashboard("investors");
    const cols = getKnownColumns(d, d.geos.by_category);
    expect(cols.has("category_type")).toBe(true);
    expect(cols.has("property_type")).toBe(true);
    expect(cols.has("investor_market_share")).toBe(true);
  });
});
