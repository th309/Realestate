import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutiveSummary } from "../ExecutiveSummary";

const score = {
  score: 73,
  label: "GOOD",
  confidenceLetter: "B",
  confidencePercent: 72,
  quarterChange: 4,
};

describe("ExecutiveSummary", () => {
  it("renders limited-data branch when limitedData=true", () => {
    render(
      <ExecutiveSummary
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={true}
      />,
    );
    expect(screen.getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders limited-data branch when score is undefined", () => {
    render(
      <ExecutiveSummary
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(screen.getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders ScoreRing, label, and confidence on happy path", () => {
    render(
      <ExecutiveSummary
        score={score}
        thesisParagraphs={["thesis 1"]}
        recommendation="rec"
        limitedData={false}
      />,
    );
    expect(screen.getByText("73")).toBeInTheDocument();
    expect(screen.getByText("GOOD")).toBeInTheDocument();
    expect(screen.getByText(/B/)).toBeInTheDocument();
    expect(screen.getByText(/72%/)).toBeInTheDocument();
  });

  it("renders quarter change with up arrow when positive", () => {
    render(
      <ExecutiveSummary
        score={score}
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(screen.getByText(/↑\s*4/)).toBeInTheDocument();
  });

  it("renders quarter change with down arrow when negative", () => {
    render(
      <ExecutiveSummary
        score={{ ...score, quarterChange: -3 }}
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(screen.getByText(/↓\s*3/)).toBeInTheDocument();
  });

  it("renders all thesis paragraphs", () => {
    render(
      <ExecutiveSummary
        score={score}
        thesisParagraphs={["para 1", "para 2"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(screen.getByText("para 1")).toBeInTheDocument();
    expect(screen.getByText("para 2")).toBeInTheDocument();
  });

  it("renders the recommendation in the pull-quote", () => {
    render(
      <ExecutiveSummary
        score={score}
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
        score={score}
        thesisParagraphs={["a"]}
        recommendation="r"
        limitedData={false}
      />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
