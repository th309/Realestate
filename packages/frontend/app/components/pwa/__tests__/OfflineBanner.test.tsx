import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OfflineBanner } from "../OfflineBanner";

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

describe("OfflineBanner", () => {
  it("stays hidden (slid off-screen) while the browser is online", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveClass("-translate-y-full");
  });

  it("shows only after a real same-origin request fails", async () => {
    setNavigatorOnline(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    render(<OfflineBanner />);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveClass("translate-y-0"),
    );
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument();
  });

  it("stays hidden when navigator says offline but the network works", async () => {
    // The bug we're fixing: a false `offline` signal must NOT strand the banner.
    setNavigatorOnline(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<OfflineBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveClass("-translate-y-full");
  });
});
