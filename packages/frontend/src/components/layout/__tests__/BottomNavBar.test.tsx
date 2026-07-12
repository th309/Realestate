import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNavBar, BOTTOM_NAV_HEIGHT_PX } from "../BottomNavBar";

let mockPathname = "/map";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("BottomNavBar", () => {
  beforeEach(() => {
    mockPathname = "/map";
  });

  it("renders exactly the 5 required destinations as links", () => {
    render(<BottomNavBar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);

    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/map",
      "/market",
      "/screener",
      "/reports",
      "/analyzer",
    ]);
    expect(nav).toBeTruthy();
  });

  it("marks the destination matching the current pathname as active via aria-current", () => {
    mockPathname = "/market";
    render(<BottomNavBar />);
    const activeLink = screen.getByRole("link", { current: "page" });
    expect(activeLink.getAttribute("href")).toBe("/market");
  });

  it("treats nested routes under a destination as active (startsWith)", () => {
    mockPathname = "/reports/some-report-id";
    render(<BottomNavBar />);
    const activeLink = screen.getByRole("link", { current: "page" });
    expect(activeLink.getAttribute("href")).toBe("/reports");
  });

  it("has no active link when pathname does not match any destination", () => {
    mockPathname = "/pricing";
    render(<BottomNavBar />);
    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
  });

  it("gives every destination a minimum 48px touch target", () => {
    render(<BottomNavBar />);
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link.className).toMatch(/min-h-\[48px\]|min-h-12/);
      expect(link.className).toMatch(/min-w-\[48px\]|min-w-12/);
    });
  });

  it("exposes BOTTOM_NAV_HEIGHT_PX and sets it as a CSS custom property on the nav element", () => {
    render(<BottomNavBar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(BOTTOM_NAV_HEIGHT_PX).toBeGreaterThanOrEqual(64);
    expect(BOTTOM_NAV_HEIGHT_PX).toBeLessThanOrEqual(80);
    expect(nav.style.getPropertyValue("--piq-bottom-nav-height")).toContain(
      `${BOTTOM_NAV_HEIGHT_PX}px`,
    );
  });

  it.each([
    "/auth/sign-in",
    "/onboarding",
    "/embed/map-full",
    "/shared/report/abc123",
  ])("renders nothing on blocklisted route %s", (route) => {
    mockPathname = route;
    const { container } = render(<BottomNavBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders on the map route (full-viewport canvas page)", () => {
    mockPathname = "/map";
    render(<BottomNavBar />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
  });

  it("is hidden at lg breakpoint and above via lg:hidden", () => {
    render(<BottomNavBar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toMatch(/\blg:hidden\b/);
  });
});
