import { fetchScoredByPeriod } from "./scored-set-client";

const PERIODS_URL_SUBSTR = "/periods";

function makeFetch(
  periodsPayload: { periods: string[] },
  idsMap: Record<string, string[]>,
) {
  return jest.fn(async (url: string) => {
    const urlStr = String(url);
    if (urlStr.includes(PERIODS_URL_SUBSTR)) {
      return {
        ok: true,
        json: async () => periodsPayload,
        text: async () => "",
      };
    }
    const match = urlStr.match(/[?&]date=([^&]+)/);
    const date = match ? match[1] : "";
    return {
      ok: true,
      json: async () => ({ ids: idsMap[date] ?? [] }),
      text: async () => "",
    };
  }) as unknown as typeof fetch;
}

afterEach(() => {
  // restore global fetch after each test
  (global as Record<string, unknown>).fetch = undefined;
});

describe("fetchScoredByPeriod — fail-closed: empty periods", () => {
  it("throws when the periods list is empty", async () => {
    global.fetch = makeFetch({ periods: [] }, {});
    await expect(fetchScoredByPeriod("http://api", "metro")).rejects.toThrow(
      /fail-closed/i,
    );
  });
});

describe("fetchScoredByPeriod — fail-closed: empty latest-period ids", () => {
  it("throws when the latest period returns an empty ids array", async () => {
    global.fetch = makeFetch(
      { periods: ["2026-05", "2026-04"] },
      { "2026-05": [], "2026-04": ["x"] },
    );
    await expect(fetchScoredByPeriod("http://api", "county")).rejects.toThrow(
      /fail-closed/i,
    );
  });
});

describe("fetchScoredByPeriod — happy path", () => {
  it("returns populated Map keyed by period date", async () => {
    global.fetch = makeFetch(
      { periods: ["2026-05", "2026-04"] },
      { "2026-05": ["a", "b"], "2026-04": ["b", "c"] },
    );
    const { periods, scoredByPeriod } = await fetchScoredByPeriod(
      "http://api",
      "zip",
    );
    expect(periods).toEqual(["2026-05", "2026-04"]);
    expect(scoredByPeriod.size).toBe(2);
    expect([...scoredByPeriod.get("2026-05")!].sort()).toEqual(["a", "b"]);
    expect([...scoredByPeriod.get("2026-04")!].sort()).toEqual(["b", "c"]);
  });
});
