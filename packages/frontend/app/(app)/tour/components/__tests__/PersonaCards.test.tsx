import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonaCards } from "../PersonaCards";

const setPersona = vi.fn();
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ setPersona }),
}));

describe("PersonaCards", () => {
  beforeEach(() => setPersona.mockReset());

  it("renders three persona cards", () => {
    render(<PersonaCards />);
    expect(screen.getByRole("button", { name: /agent/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /investor/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /homebuyer/i }),
    ).toBeInTheDocument();
  });

  it('calls setPersona("agent") when the agent card is clicked', () => {
    render(<PersonaCards />);
    fireEvent.click(screen.getByRole("button", { name: /agent/i }));
    expect(setPersona).toHaveBeenCalledWith("agent");
  });

  it('calls setPersona("investor") when the investor card is clicked', () => {
    render(<PersonaCards />);
    fireEvent.click(screen.getByRole("button", { name: /investor/i }));
    expect(setPersona).toHaveBeenCalledWith("investor");
  });

  it('calls setPersona("homebuyer") when the homebuyer card is clicked', () => {
    render(<PersonaCards />);
    fireEvent.click(screen.getByRole("button", { name: /homebuyer/i }));
    expect(setPersona).toHaveBeenCalledWith("homebuyer");
  });

  it("does not render a 'For you' priority badge (all personas are equal choices)", () => {
    render(<PersonaCards />);
    // The agent card previously carried a "For you" badge that made the choice
    // feel pre-made; it was removed so all three personas read as equal options.
    expect(screen.queryByText(/for you/i)).toBeNull();
  });

  it("persona bullet items are positioned (relative) so before:absolute anchors correctly", () => {
    const { container } = render(<PersonaCards />);
    const bulletItems = container.querySelectorAll("li.before\\:absolute");
    expect(bulletItems.length).toBeGreaterThan(0);
    bulletItems.forEach((li) => {
      expect(li.className).toContain("relative");
    });
  });
});
