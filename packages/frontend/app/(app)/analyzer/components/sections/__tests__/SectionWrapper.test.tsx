import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SectionWrapper } from "../SectionWrapper";

describe("SectionWrapper", () => {
  it("default open shows children", () => {
    const { getByText } = render(
      <SectionWrapper id="x" title="Section X">
        child
      </SectionWrapper>,
    );
    expect(getByText("child")).toBeTruthy();
  });

  it("clicking header collapses", () => {
    const { getByText, queryByText } = render(
      <SectionWrapper id="x" title="Section X">
        child
      </SectionWrapper>,
    );
    fireEvent.click(getByText("Section X"));
    expect(queryByText("child")).toBeFalsy();
  });

  it("refresh button calls onRefresh and stops propagation", () => {
    const onRefresh = vi.fn();
    const { getByLabelText, getByText } = render(
      <SectionWrapper id="x" title="Section X" onRefresh={onRefresh}>
        child
      </SectionWrapper>,
    );
    fireEvent.click(getByLabelText(/refresh/i));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // Section should still be open (event didn't bubble to header toggle)
    expect(getByText("child")).toBeTruthy();
  });

  it("renders the AI insight row when aiText is non-empty", () => {
    const { container } = render(
      <SectionWrapper id="x" title="X" aiText="AI text">
        child
      </SectionWrapper>,
    );
    expect(container.querySelector("[data-section-ai]")?.textContent).toContain(
      "AI text",
    );
  });

  it("hides the AI insight row when aiText is null/empty", () => {
    const { container } = render(
      <SectionWrapper id="x" title="X" aiText={null}>
        child
      </SectionWrapper>,
    );
    expect(container.querySelector("[data-section-ai]")).toBeNull();
  });

  it("shows the insight row while aiIsLoading is true", () => {
    const { container } = render(
      <SectionWrapper id="x" title="X" aiText={null} aiIsLoading>
        child
      </SectionWrapper>,
    );
    expect(container.querySelector("[data-section-ai]")).toBeTruthy();
  });
});
