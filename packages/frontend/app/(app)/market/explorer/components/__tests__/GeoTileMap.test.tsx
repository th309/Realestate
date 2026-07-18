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
  it("renders a region's real value even when its color scalar couldn't be computed (the StateTileMap bug this replaces)", () => {
    render(
      <GeoTileMap
        {...baseProps}
        colorByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    expect(screen.getByText("71")).toBeInTheDocument();
  });

  it("colors a region with no color scalar using the neutral fallback, not a hidden/gray non-interactive tile", () => {
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        colorByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    const path = container.querySelector('path[data-region-id="48"]');
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute("fill");
  });

  it("fill color tracks colorByRegion, not a value frozen to one metric — the bug this fixes", () => {
    // Two regions given opposite color scalars (0 vs 100) must render
    // visibly different fills — the underlying bug was the fill staying
    // identical regardless of which metric (and therefore which scalar) was
    // selected.
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        colorByRegion={{ "48": 0, "06": 100 }}
        valueByRegion={{ "48": 10, "06": 90 }}
      />,
    );
    const low = container.querySelector('path[data-region-id="48"]');
    const high = container.querySelector('path[data-region-id="06"]');
    expect(low?.getAttribute("fill")).not.toBe(high?.getAttribute("fill"));
  });

  it("clicking a region calls onSelect with its id", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        onSelect={onSelect}
        colorByRegion={{ "48": 60 }}
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
        colorByRegion={{ "48": 60 }}
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
        colorByRegion={{}}
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
        colorByRegion={{}}
        valueByRegion={{}}
      />,
    );
    expect(screen.getByText(/couldn.t load|error/i)).toBeInTheDocument();
  });

  it("renders at a fixed frame height regardless of a portrait (tall) boundaries viewBox", () => {
    // A portrait viewBox (height > width, like a tall/narrow metro) must not
    // inflate the on-screen map — preserveAspectRatio letterboxes it instead
    // of the SVG's intrinsic ratio dictating the rendered height.
    const portraitBoundaries: GeoBoundaries = {
      ...boundaries,
      viewBoxWidth: 300,
      viewBoxHeight: 900,
    };
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        boundaries={portraitBoundaries}
        colorByRegion={{ "48": 60 }}
        valueByRegion={{ "48": 60 }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("height", "580");
    expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  });
});
