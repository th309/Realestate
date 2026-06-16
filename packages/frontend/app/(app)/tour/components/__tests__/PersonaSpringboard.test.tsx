import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonaSpringboard } from "../PersonaSpringboard";

const market = { geoLevel: "metro" as const, geoId: "39580", name: "Boise" };

describe("PersonaSpringboard", () => {
  it("always leads with the Connect Claude hero", () => {
    render(<PersonaSpringboard persona="investor" market={market} />);
    const cards = screen.getAllByRole("link");
    expect(cards[0]).toHaveTextContent(/Connect Claude/i);
    expect(cards[0]).toHaveAttribute("href", "/docs/mcp");
  });
  it("deep-links the investor's analyzer card", () => {
    render(<PersonaSpringboard persona="investor" market={market} />);
    expect(
      screen.getByRole("link", { name: /analyze a deal/i }),
    ).toHaveAttribute("href", "/analyzer");
  });
});
