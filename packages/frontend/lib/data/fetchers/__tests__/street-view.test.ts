import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchStreetView } from "../street-view";
import * as base from "../base";

describe("fetchStreetView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests the resolve endpoint with lat and lon query params", async () => {
    const spy = vi.spyOn(base, "fetchAPI").mockResolvedValue({
      available: true,
      url: "https://maps.googleapis.com/x",
      panoId: "P1",
      capturedAt: "2023-10",
    });

    await fetchStreetView(40.4574, -88.9931);

    expect(spy).toHaveBeenCalledWith(
      "/api/street-view/resolve?lat=40.4574&lon=-88.9931",
    );
  });

  it("returns an unavailable resolution when the request fails", async () => {
    vi.spyOn(base, "fetchAPI").mockRejectedValue(new Error("500"));

    await expect(fetchStreetView(40.4574, -88.9931)).resolves.toEqual({
      available: false,
      url: null,
      panoId: null,
      capturedAt: null,
    });
  });
});
