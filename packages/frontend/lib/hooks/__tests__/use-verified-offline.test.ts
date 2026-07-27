import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVerifiedOffline } from "../use-verified-offline";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setNavigatorOnline(true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useVerifiedOffline", () => {
  it("reports online with no probe when the browser says online", () => {
    setNavigatorOnline(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useVerifiedOffline());

    expect(result.current).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports offline only after a real same-origin request fails", async () => {
    setNavigatorOnline(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const { result } = renderHook(() => useVerifiedOffline());

    // Not stranded on the browser flag: it flips only once the probe fails.
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays online when navigator lies but the network actually works", async () => {
    setNavigatorOnline(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useVerifiedOffline());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
