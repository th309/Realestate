import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { GeoTileMap } from "../GeoTileMap";
import type { GeoBoundaries } from "../../lib/useGeoBoundaries";

const boundaries: GeoBoundaries = {
  parentOutline: "M0,0L900,0L900,600L0,600Z",
  viewBoxWidth: 900,
  viewBoxHeight: 600,
  features: [
    { id: "48", path: "M100,100L200,100L200,200L100,200Z" }, // 100x100 -> gets a label
    { id: "06", path: "M300,100L305,100L305,105L300,100Z" }, // 5x5 -> too small for a label
  ],
  isLoading: false,
  error: null,
};

const baseProps = {
  boundaries,
  format: "index" as const,
  selectedId: null,
  onSelect: vi.fn(),
  onDrill: vi.fn(),
};

describe("GeoTileMap", () => {
  it("renders a region's real value even when it has no PropertyIQ Score (the StateTileMap bug this replaces)", () => {
    render(
      <GeoTileMap
        {...baseProps}
        scoreByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    expect(screen.getByText("71")).toBeInTheDocument();
  });

  it("colors a region with no score using the neutral fallback, not a hidden/gray non-interactive tile", () => {
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        scoreByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    const path = container.querySelector('path[data-region-id="48"]');
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute("fill");
  });

  it("clicking a region calls onSelect with its id", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        onSelect={onSelect}
        scoreByRegion={{ "48": 60 }}
        valueByRegion={{ "48": 60 }}
      />,
    );
    fireEvent.click(container.querySelector('path[data-region-id="48"]')!);
    expect(onSelect).toHaveBeenCalledWith("48");
  });

  it("double-clicking a region calls onDrill with just its id", () => {
    const onDrill = vi.fn();
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        onDrill={onDrill}
        scoreByRegion={{ "48": 60 }}
        valueByRegion={{ "48": 60 }}
      />,
    );
    fireEvent.doubleClick(
      container.querySelector('path[data-region-id="48"]')!,
    );
    expect(onDrill).toHaveBeenCalledWith("48");
  });

  it("renders a loading state without crashing when boundaries are still loading", () => {
    render(
      <GeoTileMap
        {...baseProps}
        boundaries={{ ...boundaries, isLoading: true, features: [] }}
        scoreByRegion={{}}
        valueByRegion={{}}
      />,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders an error state without crashing", () => {
    render(
      <GeoTileMap
        {...baseProps}
        boundaries={{ ...boundaries, error: new Error("boom"), features: [] }}
        scoreByRegion={{}}
        valueByRegion={{}}
      />,
    );
    expect(screen.getByText(/couldn.t load|error/i)).toBeInTheDocument();
  });
});
