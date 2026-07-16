import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeroVisualization } from "../HeroVisualization";

describe("HeroVisualization", () => {
  it("renders title, chart, and toggles the view", () => {
    const onSetView = vi.fn();
    render(
      <HeroVisualization
        title="PropertyIQ Score across 40 metros"
        hint="Click a bubble…"
        view="bubbles"
        onSetView={onSetView}
        hasNearby={false}
        includeNearby={false}
        onToggleNearby={() => {}}
        nearbyLabel="+ Nearby"
        chart={<div data-testid="chart" />}
        scrubber={<div data-testid="scrubber" />}
      />,
    );
    expect(screen.getByText(/across 40 metros/)).toBeTruthy();
    expect(screen.getByTestId("chart")).toBeTruthy();
    fireEvent.click(screen.getByText("Map"));
    expect(onSetView).toHaveBeenCalledWith("map");
  });
});
