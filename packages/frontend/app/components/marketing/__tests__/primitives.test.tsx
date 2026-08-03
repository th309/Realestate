import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "../Section";

describe("Section", () => {
  it("renders its children", () => {
    render(<Section>hello</Section>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("defaults to surface A and the standard rhythm", () => {
    const { container } = render(<Section>x</Section>);
    const section = container.querySelector("section");
    expect(section?.className).toContain("bg-surface");
    expect(section?.className).toContain("py-20 lg:py-28");
  });

  it("applies surface B when asked", () => {
    const { container } = render(<Section surface="b">x</Section>);
    expect(container.querySelector("section")?.className).toContain(
      "bg-surface-container-low",
    );
  });

  it("applies the tight rhythm when asked", () => {
    const { container } = render(<Section rhythm="tight">x</Section>);
    expect(container.querySelector("section")?.className).toContain(
      "py-12 lg:py-16",
    );
  });

  it("wraps children in the shared container", () => {
    const { container } = render(<Section>x</Section>);
    const inner = container.querySelector("section > div");
    expect(inner?.className).toContain("max-w-6xl");
    expect(inner?.className).toContain("px-6 lg:px-8");
  });

  it("forwards an id for in-page anchors", () => {
    const { container } = render(<Section id="proof">x</Section>);
    expect(container.querySelector("section")?.id).toBe("proof");
  });
});
