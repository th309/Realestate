import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../AppBarActions", () => ({
  AppBarActions: () => <div data-testid="app-bar-actions" />,
}));

const mockPathname = vi.hoisted(() => ({ current: "/analyzer" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

import { AppBar } from "../AppBar";

beforeEach(() => {
  mockPathname.current = "/analyzer";
});

/**
 * The map carried its own left icon rail. Its entries pointed at destinations
 * that lived in NO other chrome, so deleting the rail without somewhere for
 * them to go would have made them unreachable from every authed surface.
 * These assertions are the reason the overflow exists.
 */
describe("AppBar reaches every destination the map rail had", () => {
  const RAIL_DESTINATIONS = [
    "/",
    "/about",
    "/analyzer",
    "/graphs",
    "/map",
    "/market",
    "/pricing",
    "/reports",
  ];

  it("can reach all of them once the overflow is open", () => {
    render(<AppBar />);
    fireEvent.click(screen.getByRole("button", { name: /more destinations/i }));
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    for (const href of RAIL_DESTINATIONS) {
      expect(hrefs).toContain(href);
    }
  });

  it("promotes Market into the main row, not the overflow", () => {
    // It is a first-class tool; burying it behind More would be a demotion.
    render(<AppBar />);
    expect(screen.getByRole("link", { name: /Market/ })).toHaveAttribute(
      "href",
      "/market",
    );
  });
});

describe("AppBar overflow menu", () => {
  it("is closed until asked for", () => {
    render(<AppBar />);
    expect(screen.queryByRole("list", { name: /more destinations/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /more destinations/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and reports it", () => {
    render(<AppBar />);
    const trigger = screen.getByRole("button", { name: /more destinations/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: /more destinations/i });
    expect(list).toBeInTheDocument();
    expect(list.querySelectorAll("a")).toHaveLength(3);
  });

  it("closes on Escape", () => {
    render(<AppBar />);
    fireEvent.click(screen.getByRole("button", { name: /more destinations/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("list", { name: /more destinations/i })).toBeNull();
  });

  it("closes on an outside click", () => {
    render(<AppBar />);
    fireEvent.click(screen.getByRole("button", { name: /more destinations/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("list", { name: /more destinations/i })).toBeNull();
  });

  it("marks the trigger active when the current route lives inside it", () => {
    mockPathname.current = "/pricing";
    render(<AppBar />);
    // Without this, standing on /pricing leaves the whole bar looking inert.
    expect(
      screen.getByRole("button", { name: /more destinations/i }).className,
    ).toContain("bg-primary");
  });

  it("marks the current overflow item with aria-current", () => {
    mockPathname.current = "/graphs";
    render(<AppBar />);
    fireEvent.click(screen.getByRole("button", { name: /more destinations/i }));
    expect(screen.getByRole("link", { name: /Graphs/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not light up /market on the /markets SEO route", () => {
    // Segment-bounded matching, same reason app-routes.ts uses it.
    mockPathname.current = "/markets/austin-tx";
    render(<AppBar />);
    expect(screen.getByRole("link", { name: /Market/ })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
