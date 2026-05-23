import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { mapRowToRecord, processRows } from "../redfin-dc-csv-processor";
import { getDashboard } from "../redfin-dc-config";

const KNOWN_COLUMNS = [
  "region_id",
  "region_name",
  "period_begin",
  "period_end",
  "frequency",
  "last_updated",
  "price_drops",
  "price_drops_mom",
  "price_drops_yoy",
  "average_size_of_price_drop",
  "average_size_of_price_drop_mom",
  "average_size_of_price_drop_yoy",
  "percent_active_with_price_drops",
  "percent_active_with_price_drops_mom",
  "percent_active_with_price_drops_yoy",
];

const fakeResolve = async (_s: any, _g: string, name: string) => ({
  regionId: name.startsWith("Akron") ? "10420" : "12420",
  resolved: true,
});

function loadFixtureRows() {
  const csv = readFileSync(
    join(__dirname, "..", "__fixtures__", "price_drops_metro_sample.csv"),
    "utf-8",
  );
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

describe("mapRowToRecord", () => {
  it("normalizes columns, converts NA to null, attaches region_id", async () => {
    const rows = loadFixtureRows();
    const rec = await mapRowToRecord(
      {} as any,
      rows[0],
      "metro",
      getDashboard("price_drops").geos.metro,
      new Set(KNOWN_COLUMNS),
      fakeResolve as any,
    );
    expect(rec).not.toBeNull();
    expect(rec!.region_id).toBe("10420");
    expect(rec!.region_name).toBe("Akron, OH metro area");
    expect(rec!.period_end).toBe("2026-04-30");
    expect(rec!.price_drops).toBe(1234);
    expect(rec!.price_drops_yoy).toBeNull();
    expect(rec!.average_size_of_price_drop_mom).toBe(0.1);
    expect("region_type" in rec!).toBe(false);
  });

  it("keeps textDims columns as strings, not number-parsed", async () => {
    const row = {
      "PERIOD END": "2026-04-30",
      "REGION TYPE": "Metro",
      "REGION NAME": "Austin, TX metro area",
      "PROPERTY TYPE": "All Residential",
      "BALANCE OF POWER": "Buyers Market",
      BUYERS: "1000",
    } as Record<string, string>;
    const rec = await mapRowToRecord(
      {} as any,
      row,
      "metro",
      getDashboard("buyers_and_sellers").geos.metro,
      new Set([
        "region_id",
        "region_name",
        "period_end",
        "property_type",
        "balance_of_power",
        "buyers",
      ]),
      fakeResolve as any,
    );
    expect(rec!.property_type).toBe("All Residential");
    expect(rec!.balance_of_power).toBe("Buyers Market");
    expect(rec!.buyers).toBe(1000);
  });

  it("sets region_id to US for noGeo targets without calling resolve", async () => {
    const row = {
      "PERIOD END": "2026-04-30",
      "REGION TYPE": "Country",
      "REGION NAME": "National",
      "CATEGORY TYPE": "price_tier",
      CATEGORY: "Affordable",
      "INVESTOR HOME PURCHASES": "500",
    } as Record<string, string>;
    let resolveCalled = false;
    const trackingResolve = async () => {
      resolveCalled = true;
      return { regionId: "SHOULD_NOT_BE_USED", resolved: true };
    };
    const rec = await mapRowToRecord(
      {} as any,
      row,
      "by_category",
      getDashboard("investors").geos.by_category,
      new Set([
        "region_id",
        "region_name",
        "period_end",
        "category_type",
        "category",
        "investor_home_purchases",
      ]),
      trackingResolve as any,
    );
    expect(rec!.region_id).toBe("US");
    expect(resolveCalled).toBe(false);
    expect(rec!.category_type).toBe("price_tier");
    expect(rec!.investor_home_purchases).toBe(500);
  });
});

describe("processRows", () => {
  it("maps all rows and tracks the latest period_end", async () => {
    const rows = loadFixtureRows();
    const out = await processRows(
      {} as any,
      rows,
      "metro",
      getDashboard("price_drops").geos.metro,
      KNOWN_COLUMNS,
      fakeResolve as any,
    );
    expect(out.records).toHaveLength(3);
    expect(out.skipped).toBe(0);
    expect(out.latestPeriodEnd).toBe("2026-04-30");
  });

  it("hard-fails when >10% of rows are unresolvable", async () => {
    const rows = loadFixtureRows();
    const allUnresolved = async () => ({
      regionId: "REDFIN-METRO-X",
      resolved: false,
    });
    await expect(
      processRows(
        {} as any,
        rows,
        "metro",
        getDashboard("price_drops").geos.metro,
        KNOWN_COLUMNS,
        allUnresolved as any,
      ),
    ).rejects.toThrow(/unresolved/i);
  });
});
