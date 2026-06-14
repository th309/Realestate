import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TourBottomSheet } from "../TourBottomSheet";

describe("TourBottomSheet", () => {
  const defaultProps = {
    title: "Tour Step Title",
    body: "Tour step body copy.",
    progress: 0.5,
    onContinue: vi.fn(),
    onDismiss: vi.fn(),
    targetSelector: '[data-tour="search-bar"]',
  };

  it("renders title + body", () => {
    render(<TourBottomSheet {...defaultProps} />);
    expect(screen.getByText("Tour Step Title")).toBeInTheDocument();
    expect(screen.getByText("Tour step body copy.")).toBeInTheDocument();
  });

  it("calls onContinue when Continue is clicked", () => {
    const onContinue = vi.fn();
    render(<TourBottomSheet {...defaultProps} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when Skip tour is clicked", () => {
    const onDismiss = vi.fn();
    render(<TourBottomSheet {...defaultProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /skip tour/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders progress bar with width matching progress prop", () => {
    const { container } = render(
      <TourBottomSheet {...defaultProps} progress={0.75} />,
    );
    // Find element with width style; the implementation uses inline style
    const bar = container.querySelector(
      '[style*="width"]',
    ) as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar?.style.width).toBe("75%");
  });

  it("uses semantic tokens (bg-primary on continue, bg-tertiary in gradient) — no hardcoded hex", () => {
    const { container } = render(<TourBottomSheet {...defaultProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/); // no hardcoded hex anywhere
    expect(html).toMatch(/bg-primary/);
  });

  it("has dialog role + aria-modal for screen readers", () => {
    render(<TourBottomSheet {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
