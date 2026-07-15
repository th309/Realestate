import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { StateTileMap } from "../StateTileMap";

describe("StateTileMap", () => {
  const props = {
    entities: [{ id: "48", name: "Texas", state: "TX" }],
    scoreByRegion: { "48": 62 } as Record<string, number | null>,
    valueByRegion: { "48": 5.1 } as Record<string, number | null>,
    format: "percent" as const,
  };
  it("renders a tile per grid position and drills the clicked state", () => {
    const onDrill = vi.fn();
    render(<StateTileMap {...props} onDrill={onDrill} />);
    fireEvent.click(screen.getByText("TX"));
    expect(onDrill).toHaveBeenCalledWith("48", "Texas", "TX");
  });
});
