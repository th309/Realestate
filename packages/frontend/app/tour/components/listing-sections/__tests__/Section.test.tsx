import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "../Section";

describe("Section", () => {
  it("renders num, title, and children", () => {
    render(
      <Section num="01" title="The market right now">
        <p>body content</p>
      </Section>,
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("The market right now")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <Section num="02" title="Title" subtitle="A helpful subtitle">
        <span />
      </Section>,
    );
    expect(screen.getByText("A helpful subtitle")).toBeInTheDocument();
  });

  it("does not render subtitle when omitted", () => {
    const { container } = render(
      <Section num="03" title="No subtitle here">
        <span />
      </Section>,
    );
    expect(container.querySelector("header p")).toBeNull();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <Section num="04" title="Title">
        <span />
      </Section>,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
