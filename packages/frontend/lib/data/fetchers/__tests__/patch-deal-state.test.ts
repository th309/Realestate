import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { patchDealState } from "../analyzer";

vi.mock("../auth-headers", () => ({
  getAuthHeaders: async () => ({ Authorization: "Bearer t" }),
}));

describe("patchDealState", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes the state-only route with the snapshot", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
    });

    await patchDealState("row-1", { v: 2, price: 300000 });

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(String(url)).toContain("/api/analyzer/saved/row-1/state");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      input_snapshot: { v: 2, price: 300000 },
    });
  });

  it("throws on a non-ok response so the caller can surface a retry", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(patchDealState("row-1", { v: 2 })).rejects.toThrow("404");
  });
});
