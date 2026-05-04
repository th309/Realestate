import { describe, it, expect } from "vitest";
import { resolveMetricFreshnessDate } from "../freshness";
import type { DataFreshnessResponse } from "../fetchers/freshness";

function makeFreshness(overrides: {
  tableDates?: Record<string, string | null>;
  sourceDates?: Record<string, string | null>;
}): DataFreshnessResponse {
  return {
    generatedAt: "2026-05-03T00:00:00.000Z",
    tableDates: overrides.tableDates ?? {},
    sourceDates: overrides.sourceDates ?? {},
    zillowDates: {
      historicalByGeo: {
        state: null,
        metro: null,
        county: null,
        city: null,
        zip: null,
      },
      forecastByGeo: {},
    },
    economicMetricDates: {
      unemployment_rate: {},
      employment_yoy: {},
      gdp_yoy: {},
      rpp_all_items: {},
    },
  };
}

describe("resolveMetricFreshnessDate — bls/irs/redfin_migration sources", () => {
  it("resolves a BLS QCEW metric to the most recent economic_metro/county date", () => {
    const data = makeFreshness({
      tableDates: {
        economic_metro: "2025-09-01",
        economic_county: "2025-06-01",
      },
    });

    // qcew_avg_weekly_wage hits /api/metrics/... → falls through registry switch
    // for dataSource 'bls' to pickSourceFallback.
    const result = resolveMetricFreshnessDate(
      "qcew_avg_weekly_wage",
      data,
      "metro",
    );

    expect(result).toBe("2025-09-01");
  });

  it("resolves a BLS CES sector metric via economic_county fallback", () => {
    const data = makeFreshness({
      tableDates: {
        economic_metro: null,
        economic_county: "2025-10-01",
      },
    });

    const result = resolveMetricFreshnessDate(
      "employment_construction",
      data,
      "county",
    );

    expect(result).toBe("2025-10-01");
  });

  it("resolves an IRS migration metric to the irs_migration_county_aggregates tax_year", () => {
    const data = makeFreshness({
      tableDates: {
        irs_migration_county_aggregates: "2023",
      },
    });

    const result = resolveMetricFreshnessDate(
      "irs_migration_in_returns",
      data,
      "county",
    );

    expect(result).toBe("2023");
  });

  it("resolves a Redfin migration metric to the redfin_migration_metro period_date", () => {
    const data = makeFreshness({
      tableDates: {
        redfin_migration_metro: "2025-04-30",
      },
    });

    const result = resolveMetricFreshnessDate(
      "redfin_migration_net_inflow",
      data,
      "metro",
    );

    expect(result).toBe("2025-04-30");
  });

  it("prefers sourceDates.bls when both sourceDates and tableDates are present", () => {
    const data = makeFreshness({
      tableDates: {
        economic_metro: "2025-01-01",
      },
      sourceDates: {
        bls: "2025-09-01",
      },
    });

    const result = resolveMetricFreshnessDate(
      "qcew_avg_weekly_wage",
      data,
      "metro",
    );

    expect(result).toBe("2025-09-01");
  });
});
