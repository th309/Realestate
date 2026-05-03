import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiStrategy } from "../AiStrategy";

const baseProps = {
  thesis: "This market is a 12-month appreciation play.",
  strategyParagraphs: [
    "Lead with the trajectory data — buyers are paying for growth, not the cap rate.",
    "Anchor on the peer set; do not let comps drag the conversation to nominal price.",
  ],
  actions: [
    {
      title: "Open with trajectory",
      desc: "Show the 12-month YoY chart first.",
    },
    {
      title: "Frame against peers",
      desc: "Reference the 5 peer markets we ranked.",
    },
    {
      title: "Close on migration",
      desc: "Net-positive inflow underwrites the thesis.",
    },
  ],
  fallbackUsed: false,
};

describe("AiStrategy", () => {
  it("renders unavailable message when no thesis and no paragraphs (limited-data branch)", () => {
    render(
      <AiStrategy
        thesis=""
        strategyParagraphs={[]}
        actions={[]}
        fallbackUsed={false}
      />,
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders thesis on happy path", () => {
    render(<AiStrategy {...baseProps} />);
    expect(screen.getByText(baseProps.thesis)).toBeInTheDocument();
  });

  it("renders all strategy paragraphs", () => {
    render(<AiStrategy {...baseProps} />);
    expect(
      screen.getByText(baseProps.strategyParagraphs[0]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(baseProps.strategyParagraphs[1]),
    ).toBeInTheDocument();
  });

  it("renders all action items with title and desc", () => {
    render(<AiStrategy {...baseProps} />);
    baseProps.actions.forEach((a) => {
      expect(screen.getByText(a.title)).toBeInTheDocument();
      expect(screen.getByText(a.desc)).toBeInTheDocument();
    });
    // Numbered badges 01, 02, 03
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("shows the AI Strategy label without (fallback) when fallbackUsed=false", () => {
    render(<AiStrategy {...baseProps} />);
    const label = screen.getByText(/AI Strategy/i);
    expect(label.textContent).not.toMatch(/fallback/i);
  });

  it("shows the (fallback) suffix when fallbackUsed=true", () => {
    render(<AiStrategy {...baseProps} fallbackUsed={true} />);
    expect(screen.getByText(/fallback/i)).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<AiStrategy {...baseProps} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
