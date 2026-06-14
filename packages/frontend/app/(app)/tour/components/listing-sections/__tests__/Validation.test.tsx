import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Validation } from "../Validation";

describe("Validation", () => {
  const props = {
    directionalAccuracy: 78,
    observations: 412,
    excessReturn3y: 6.3,
    vsLabel: "state median",
    averageOutperformance: 2.4,
    limitedData: false,
  };

  it("renders limited-data branch when limitedData=true", () => {
    render(<Validation {...props} limitedData={true} />);
    expect(
      screen.getByText(/validation data unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders the directional accuracy and observation count", () => {
    render(<Validation {...props} />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
    expect(screen.getByText(/412 observations/)).toBeInTheDocument();
  });

  it("formats positive 3-year excess return with leading +", () => {
    render(<Validation {...props} excessReturn3y={6.3} />);
    expect(
      screen.getByText(/3-year excess return: \+6\.3%/),
    ).toBeInTheDocument();
  });

  it("formats negative 3-year excess return without artificial +", () => {
    render(<Validation {...props} excessReturn3y={-2.5} />);
    expect(
      screen.getByText(/3-year excess return: -2\.5%/),
    ).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Validation {...props} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
