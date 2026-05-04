import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/api-client", () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from "../../lib/api-client";
import {
  handleGetEmploymentBySector,
  EMPLOYMENT_SECTOR_METRICS,
} from "../employment";

const mockedFetchApi = vi.mocked(fetchApi);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleGetEmploymentBySector", () => {
  it("fans out one fetchApi call per sector (11 total) for a county", async () => {
    mockedFetchApi.mockResolvedValue({ value: 12345 });

    const text = await handleGetEmploymentBySector({
      geoLevel: "county",
      geoId: "06037",
    });

    expect(mockedFetchApi).toHaveBeenCalledTimes(
      EMPLOYMENT_SECTOR_METRICS.length,
    );
    expect(EMPLOYMENT_SECTOR_METRICS.length).toBe(11);

    // Spot check first metric path
    expect(mockedFetchApi).toHaveBeenCalledWith(
      `/api/metrics/${EMPLOYMENT_SECTOR_METRICS[0]}/county/06037`,
    );

    const parsed = JSON.parse(text);
    expect(parsed.geoLevel).toBe("county");
    expect(parsed.geoId).toBe("06037");
    expect(parsed.sectors).toBeDefined();
    expect(Object.keys(parsed.sectors)).toHaveLength(11);
  });

  it("rejects unsupported geoLevel (zip)", async () => {
    await expect(
      handleGetEmploymentBySector({ geoLevel: "zip", geoId: "90210" }),
    ).rejects.toThrow(/geoLevel/i);

    expect(mockedFetchApi).not.toHaveBeenCalled();
  });

  it("supports metro and state geoLevels", async () => {
    mockedFetchApi.mockResolvedValue({ value: 100 });

    await handleGetEmploymentBySector({ geoLevel: "metro", geoId: "31080" });
    expect(mockedFetchApi).toHaveBeenCalledTimes(11);

    vi.resetAllMocks();
    mockedFetchApi.mockResolvedValue({ value: 100 });

    await handleGetEmploymentBySector({ geoLevel: "state", geoId: "CA" });
    expect(mockedFetchApi).toHaveBeenCalledTimes(11);
  });
});
