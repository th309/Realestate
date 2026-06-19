import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonaSpringboard } from "../PersonaSpringboard";

describe("PersonaSpringboard", () => {
  it("always leads with the Connect Claude hero", () => {
    render(<PersonaSpringboard />);
    const cards = screen.getAllByRole("link");
    expect(cards[0]).toHaveTextContent(/Connect Claude/i);
    expect(cards[0]).toHaveAttribute("href", "/docs/mcp");
  });
  it("deep-links the analyzer card", () => {
    render(<PersonaSpringboard />);
    expect(
      screen.getByRole("link", { name: /analyze a deal/i }),
    ).toHaveAttribute("href", "/analyzer");
  });
});
