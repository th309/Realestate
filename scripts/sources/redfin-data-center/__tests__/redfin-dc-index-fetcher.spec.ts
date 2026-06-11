import { resolveCsvUrl } from "../redfin-dc-index-fetcher";
import { S3_BASE } from "../redfin-dc-config";

describe("resolveCsvUrl", () => {
  it("prefers the index.json path when present", () => {
    const index = {
      price_drops: { metro: { all: "price_drops/monthly/all_metros.csv" } },
    };
    expect(
      resolveCsvUrl(
        index,
        "price_drops",
        "metro",
        "price_drops/monthly/all_metros.csv",
      ),
    ).toBe(`${S3_BASE}/price_drops/monthly/all_metros.csv`);
  });

  it("falls back to the configured path when index lacks the key", () => {
    expect(
      resolveCsvUrl(
        {},
        "price_drops",
        "metro",
        "price_drops/monthly/all_metros.csv",
      ),
    ).toBe(`${S3_BASE}/price_drops/monthly/all_metros.csv`);
  });
});
