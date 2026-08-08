import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "../Section";
import { SectionHeading } from "../SectionHeading";
import { Chip } from "../Chip";
import { StatTile } from "../StatTile";
import { ScreenshotFrame } from "../ScreenshotFrame";

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

describe("SectionHeading", () => {
  it("renders the title as an h2 at the section scale", () => {
    render(<SectionHeading title="Four inputs" />);
    const h2 = screen.getByRole("heading", { level: 2, name: "Four inputs" });
    expect(h2.className).toContain("text-2xl md:text-3xl");
  });

  it("renders an eyebrow when given one", () => {
    render(<SectionHeading eyebrow="How it works" title="Three steps" />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
  });

  it("renders a subhead when given one", () => {
    render(<SectionHeading title="T" subhead="Explanatory line." />);
    expect(screen.getByText("Explanatory line.")).toBeInTheDocument();
  });

  it("left-aligns when align is start", () => {
    const { container } = render(<SectionHeading title="T" align="start" />);
    expect(container.firstElementChild?.className).toContain("text-left");
  });
});

describe("Chip", () => {
  it("is a full-radius pill per the shape scale", () => {
    const { container } = render(<Chip>x</Chip>);
    expect(container.firstElementChild?.className).toContain("rounded-full");
  });

  it("applies the primary tone when asked", () => {
    const { container } = render(<Chip tone="primary">x</Chip>);
    expect(container.firstElementChild?.className).toContain("bg-primary");
  });

  it("renders an icon slot when given one", () => {
    render(<Chip icon={<svg data-testid="ic" />}>x</Chip>);
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });
});

describe("StatTile", () => {
  it("renders label, value, and caption", () => {
    render(
      <StatTile
        label="Days on market"
        value="29"
        caption="Realtor.com median"
      />,
    );
    expect(screen.getByText("Days on market")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("Realtor.com median")).toBeInTheDocument();
  });

  it("renders the value in monospace with tabular figures", () => {
    render(<StatTile label="L" value="+12.07%" />);
    const value = screen.getByText("+12.07%");
    expect(value.className).toContain("font-mono");
    expect(value.className).toContain("tabular-nums");
  });

  it("is a rounded-xl card with a shadow", () => {
    const { container } = render(<StatTile label="L" value="1" />);
    expect(container.firstElementChild?.className).toContain("rounded-xl");
    expect(container.firstElementChild?.className).toContain("shadow-sm");
  });

  it("applies the requested accent stripe", () => {
    const { container } = render(
      <StatTile label="L" value="1" accent="tertiary" />,
    );
    expect(container.firstElementChild?.className).toContain(
      "border-l-tertiary",
    );
  });
});

describe("ScreenshotFrame", () => {
  it("renders the image with its alt text", () => {
    render(
      <ScreenshotFrame
        src="/images/home/market-map-hero-v4.png"
        alt="PropertyIQ market map"
        width={1280}
        height={800}
      />,
    );
    expect(screen.getByAltText("PropertyIQ market map")).toBeInTheDocument();
  });

  it("frames the image in a rounded bordered card", () => {
    const { container } = render(
      <ScreenshotFrame src="/x.png" alt="x" width={10} height={10} />,
    );
    const frame = container.firstElementChild;
    expect(frame?.className).toContain("rounded-xl");
    expect(frame?.className).toContain("border-outline-variant");
    expect(frame?.className).toContain("overflow-hidden");
  });
});
