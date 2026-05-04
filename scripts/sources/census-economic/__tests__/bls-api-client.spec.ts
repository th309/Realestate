/**
 * Unit tests for `fetchBlsBatchRaw`.
 *
 * Covers:
 *   1. Throws when BLS responds with `status: 'REQUEST_NOT_PROCESSED'` so
 *      callers cannot mistake a rate-limit / bad-key / bad-seriesID
 *      rejection for an empty result (was a silent `Inserted: 0`).
 *   2. Splits requests into multiple HTTP calls when the year span exceeds
 *      BLS's 20-year-per-call cap, and merges per-slice series.data arrays
 *      by seriesID.
 */

jest.mock("axios");
jest.mock("../census-economic-config", () => ({
  ...jest.requireActual("../census-economic-config"),
  rateLimitWait: jest.fn().mockResolvedValue(undefined),
}));

import axios from "axios";
import { fetchBlsBatchRaw } from "../bls-api-client";

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe("fetchBlsBatchRaw error handling", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("throws when BLS returns REQUEST_NOT_PROCESSED", async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        status: "REQUEST_NOT_PROCESSED",
        responseTime: 0,
        message: ["unauthorized: invalid registrationkey"],
        Results: {},
      },
    });

    await expect(
      fetchBlsBatchRaw(["LAUCN060010000000003"], 2023, 2024),
    ).rejects.toThrow(/REQUEST_NOT_PROCESSED/);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("throws when status is missing entirely", async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    await expect(
      fetchBlsBatchRaw(["LAUCN060010000000003"], 2023, 2024),
    ).rejects.toThrow(/UNKNOWN/);
  });
});

describe("fetchBlsBatchRaw year-range chunking", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("makes 2 HTTP calls when the year span exceeds 20 and merges series.data", async () => {
    // 2000-2024 = 25 years -> two slices: 2000-2019 and 2020-2024.
    const seriesId = "SMU37395802000000001";

    mockedPost
      .mockResolvedValueOnce({
        data: {
          status: "REQUEST_SUCCEEDED",
          Results: {
            series: [
              {
                seriesID: seriesId,
                data: [
                  { year: "2019", period: "M12", value: "100.0" },
                  { year: "2018", period: "M12", value: "98.0" },
                ],
              },
            ],
          },
          message: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: "REQUEST_SUCCEEDED",
          Results: {
            series: [
              {
                seriesID: seriesId,
                data: [
                  { year: "2024", period: "M12", value: "115.0" },
                  { year: "2023", period: "M12", value: "112.0" },
                ],
              },
            ],
          },
          message: [],
        },
      });

    const result = (await fetchBlsBatchRaw([seriesId], 2000, 2024)) as {
      status: string;
      Results: { series: Array<{ seriesID: string; data: unknown[] }> };
    };

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("REQUEST_SUCCEEDED");
    expect(result.Results.series).toHaveLength(1);
    expect(result.Results.series[0].seriesID).toBe(seriesId);
    expect(result.Results.series[0].data).toHaveLength(4);

    // Verify the per-slice startyear/endyear were 2000-2019 then 2020-2024.
    const firstCallBody = mockedPost.mock.calls[0][1] as {
      startyear: string;
      endyear: string;
    };
    const secondCallBody = mockedPost.mock.calls[1][1] as {
      startyear: string;
      endyear: string;
    };
    expect(firstCallBody.startyear).toBe("2000");
    expect(firstCallBody.endyear).toBe("2019");
    expect(secondCallBody.startyear).toBe("2020");
    expect(secondCallBody.endyear).toBe("2024");
  });

  it("does not split when span is exactly 20 years", async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        status: "REQUEST_SUCCEEDED",
        Results: { series: [] },
        message: [],
      },
    });
    await fetchBlsBatchRaw(["LAUCN060010000000003"], 2005, 2024);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
