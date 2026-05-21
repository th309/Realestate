import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ViewPicker } from "../ViewPicker";

beforeEach(() => {
  localStorage.clear();
});

describe("ViewPicker", () => {
  it("default to grid3", () => {
    const { container } = render(<ViewPicker />);
    expect(
      container.querySelector("[data-view-option='grid3']")?.className,
    ).toMatch(/bg-primary/);
  });

  it("clicking emits onChange", () => {
    const onChange = vi.fn();
    const { container } = render(<ViewPicker onChange={onChange} />);
    fireEvent.click(container.querySelector("[data-view-option='tabs']")!);
    expect(onChange).toHaveBeenCalledWith("tabs");
  });

  it("clicking persists to localStorage", () => {
    const { container } = render(<ViewPicker />);
    fireEvent.click(container.querySelector("[data-view-option='winner']")!);
    expect(localStorage.getItem("analyzer.strategyView")).toBe("winner");
  });

  it("re-mount picks up persisted value from localStorage", () => {
    localStorage.setItem("analyzer.strategyView", "tabs");
    const { container } = render(<ViewPicker />);
    expect(
      container.querySelector("[data-view-option='tabs']")?.className,
    ).toMatch(/bg-primary/);
  });
});
