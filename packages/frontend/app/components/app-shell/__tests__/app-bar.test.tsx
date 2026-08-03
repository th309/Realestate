import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// AppBar's own responsibility is the dark bar and the tool navigation. The
// auth-dependent right-hand side (tier badge, alert bell, account menu, mobile
// menu) lives in AppBarActions and is covered by its own test, so it is stubbed
// here to keep this file focused on the bar itself.
vi.mock("../AppBarActions", () => ({
  AppBarActions: () => <div data-testid="app-bar-actions" />,
}));

const mockPathname = vi.hoisted(() => ({ current: "/analyzer" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

import { AppBar } from "../AppBar";

describe("AppBar", () => {
  it("renders a nav link per tool", () => {
    render(<AppBar />);
    for (const label of [
      "Dashboard",
      "Map",
      "Analyzer",
      "Screener",
      "Reports",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("uses the dark bar surface, not a hardcoded hex", () => {
    const { container } = render(<AppBar />);
    const bar = container.querySelector("header");
    expect(bar?.className).toContain("bg-inverse-surface");
    expect(container.innerHTML).not.toMatch(/\[#[0-9A-Fa-f]{6}\]/);
  });

  it("marks the active tool for assistive tech", () => {
    mockPathname.current = "/screener";
    render(<AppBar />);
    expect(screen.getByRole("link", { name: /Screener/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark a tool active on an unrelated route", () => {
    mockPathname.current = "/dashboard";
    render(<AppBar />);
    expect(screen.getByRole("link", { name: /Reports/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps the stateful account actions mounted", () => {
    render(<AppBar />);
    expect(screen.getByTestId("app-bar-actions")).toBeInTheDocument();
  });
});
