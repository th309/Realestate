import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineBanner } from "../OfflineBanner";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("OfflineBanner", () => {
  afterEach(() => {
    setNavigatorOnline(true);
  });

  it("renders the offline copy once the browser goes offline", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(
      screen.getByText(/you.re offline — showing saved data/i),
    ).toBeInTheDocument();
  });

  it("is slid off-screen while online", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);

    expect(screen.getByRole("status")).toHaveClass("-translate-y-full");
  });

  it("slides back on reconnect", () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveClass("translate-y-0");

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByRole("status")).toHaveClass("-translate-y-full");
  });
});
