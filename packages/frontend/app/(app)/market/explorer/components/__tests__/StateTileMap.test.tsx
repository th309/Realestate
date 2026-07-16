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

  it("renders gray tile with no keyboard access when score is null", () => {
    const onDrill = vi.fn();
    render(
      <StateTileMap
        entities={[{ id: "48", name: "Texas", state: "TX" }]}
        scoreByRegion={{ "48": null }}
        valueByRegion={{ "48": null }}
        format="percent"
        onDrill={onDrill}
      />,
    );
    const txText = screen.getByText("TX");
    const txTile = txText.parentElement;
    expect(txTile).not.toHaveAttribute("role", "button");
    expect(txTile).not.toHaveAttribute("tabIndex");
    fireEvent.click(txTile!);
    expect(onDrill).not.toHaveBeenCalled();
  });

  it("renders all 51 state tiles even with partial data", () => {
    const onDrill = vi.fn();
    render(
      <StateTileMap
        entities={[
          { id: "48", name: "Texas", state: "TX" },
          { id: "06", name: "California", state: "CA" },
        ]}
        scoreByRegion={{ "48": 62, "06": 75 }}
        valueByRegion={{ "48": 5.1, "06": 3.2 }}
        format="percent"
        onDrill={onDrill}
      />,
    );
    const allAbbrs = screen.getAllByText(/^[A-Z]{2}$/);
    expect(allAbbrs.length).toBe(51);
  });
});
