import {
  normalizeColumnName,
  normalizeRegionTypeToGeoLevel,
} from "../redfin-dc-column-normalizer";

describe("normalizeColumnName", () => {
  it("strips unit suffixes and snake-cases", () => {
    expect(normalizeColumnName("MEDIAN SALE PRICE MOM (%)")).toBe(
      "median_sale_price_mom",
    );
    expect(normalizeColumnName("AVERAGE SIZE OF PRICE DROP YOY (PPTS)")).toBe(
      "average_size_of_price_drop_yoy",
    );
    expect(normalizeColumnName("MEDIAN DAYS ON MARKET (DAYS)")).toBe(
      "median_days_on_market",
    );
  });

  it("keeps $-price and pct-percent columns distinct", () => {
    expect(normalizeColumnName("MEDIAN DOWN PAYMENT ($)")).toBe(
      "median_down_payment",
    );
    expect(normalizeColumnName("MEDIAN DOWN PAYMENT PCT (%)")).toBe(
      "median_down_payment_pct",
    );
  });

  it("handles embedded symbols and hyphens", () => {
    expect(normalizeColumnName("BUYER-SELLER RATIO")).toBe(
      "buyer_seller_ratio",
    );
    expect(normalizeColumnName("SELLER-BUYER % DIFFERENCE")).toBe(
      "seller_buyer_difference",
    );
  });
});

describe("normalizeRegionTypeToGeoLevel", () => {
  it("maps Redfin REGION TYPE values to our geo levels", () => {
    expect(normalizeRegionTypeToGeoLevel("Country")).toBe("country");
    expect(normalizeRegionTypeToGeoLevel("State")).toBe("state");
    expect(normalizeRegionTypeToGeoLevel("Metro")).toBe("metro");
    expect(normalizeRegionTypeToGeoLevel("County")).toBe("county");
    expect(normalizeRegionTypeToGeoLevel("Zip")).toBe("zip");
    expect(normalizeRegionTypeToGeoLevel("Census Region")).toBe(
      "census_region",
    );
  });

  it("falls back to the lowercased input for unknown region types", () => {
    expect(normalizeRegionTypeToGeoLevel("Neighborhood")).toBe("neighborhood");
    expect(normalizeRegionTypeToGeoLevel("  City  ")).toBe("city");
  });
});
