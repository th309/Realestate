import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutiveSummary } from "../ExecutiveSummary";

describe("ExecutiveSummary", () => {
  it("renders nothing when limitedData=true (no empty sections)", () => {
    const { container } = render(
      <ExecutiveSummary
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={true}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are no thesis paragraphs", () => {
    const { container } = render(
      <ExecutiveSummary
        thesisParagraphs={[]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all thesis paragraphs as the narrative", () => {
    render(
      <ExecutiveSummary
        thesisParagraphs={["para 1", "para 2"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(screen.getByText("para 1")).toBeInTheDocument();
    expect(screen.getByText("para 2")).toBeInTheDocument();
  });

  it("renders the recommendation pull-quote", () => {
    render(
      <ExecutiveSummary
        thesisParagraphs={["a"]}
        recommendation="Lead with the 12-month thesis"
        limitedData={false}
      />,
    );
    expect(
      screen.getByText("Lead with the 12-month thesis"),
    ).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <ExecutiveSummary
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
