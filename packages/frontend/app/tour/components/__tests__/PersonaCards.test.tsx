import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonaCards } from "../PersonaCards";

const setPersona = vi.fn();
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ setPersona }),
}));

describe("PersonaCards", () => {
  beforeEach(() => setPersona.mockReset());

  it("renders three persona cards (agent priority)", () => {
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

  it("priority badge uses semantic tertiary tokens, not hardcoded hex", () => {
    const { container } = render(<PersonaCards />);
    const badge = container.querySelector("span.absolute.right-3.top-3");
    expect(badge).not.toBeNull();
    const cls = badge!.className;
    expect(cls).toContain("bg-tertiary");
    expect(cls).toContain("text-on-tertiary");
    // Guard against regression to hardcoded hex.
    expect(cls).not.toContain("#00C853");
    expect(cls).not.toContain("bg-[#");
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
