import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/api-client", () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from "../../lib/api-client";
import {
  handleGetMigrationFlows,
  handleGetMigrationSummary,
} from "../migration";

const mockedFetchApi = vi.mocked(fetchApi);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleGetMigrationFlows", () => {
  it("forwards limit and direction to /api/migration/flows", async () => {
    mockedFetchApi.mockResolvedValue({ flows: [] });

    await handleGetMigrationFlows({
      source: "irs",
      fips: "06037",
      direction: "in",
      limit: 10,
    });

    expect(mockedFetchApi).toHaveBeenCalledTimes(1);
    expect(mockedFetchApi).toHaveBeenCalledWith(
      "/api/migration/flows/irs/06037",
      { direction: "in", limit: 10 },
    );
  });

  it("defaults limit when not provided", async () => {
    mockedFetchApi.mockResolvedValue({ flows: [] });

    await handleGetMigrationFlows({
      source: "redfin",
      fips: "31080",
      direction: "out",
    });

    expect(mockedFetchApi).toHaveBeenCalledWith(
      "/api/migration/flows/redfin/31080",
      expect.objectContaining({ direction: "out" }),
    );
  });

  it("rejects bad source values", async () => {
    await expect(
      handleGetMigrationFlows({
        source: "garbage" as "irs",
        fips: "06037",
        direction: "in",
      }),
    ).rejects.toThrow(/source/i);

    expect(mockedFetchApi).not.toHaveBeenCalled();
  });

  it("rejects bad direction values", async () => {
    await expect(
      handleGetMigrationFlows({
        source: "irs",
        fips: "06037",
        direction: "sideways" as "in",
      }),
    ).rejects.toThrow(/direction/i);
  });
});

describe("handleGetMigrationSummary", () => {
  it("calls 5 IRS aggregate metrics + parent-metro lookup for a county", async () => {
    // Default: every fetch resolves to a stub; parent-metro endpoint may 404.
    mockedFetchApi.mockResolvedValue({ value: 1 });

    const text = await handleGetMigrationSummary({
      geoLevel: "county",
      geoId: "06037",
    });

    // 5 IRS metric calls were issued
    const calls = mockedFetchApi.mock.calls.map((c) => c[0]);
    expect(calls).toContain(
      "/api/metrics/irs_migration_in_returns/county/06037",
    );
    expect(calls).toContain(
      "/api/metrics/irs_migration_out_returns/county/06037",
    );
    expect(calls).toContain(
      "/api/metrics/irs_migration_net_returns/county/06037",
    );
    expect(calls).toContain(
      "/api/metrics/irs_migration_in_avg_agi/county/06037",
    );
    expect(calls).toContain(
      "/api/metrics/irs_migration_out_avg_agi/county/06037",
    );

    const parsed = JSON.parse(text);
    expect(parsed.geoLevel).toBe("county");
    expect(parsed.geoId).toBe("06037");
    expect(parsed.irs).toBeDefined();
    // redfinOverlay must be present (may be null if parent-metro endpoint missing)
    expect(parsed).toHaveProperty("redfinOverlay");
  });
});
