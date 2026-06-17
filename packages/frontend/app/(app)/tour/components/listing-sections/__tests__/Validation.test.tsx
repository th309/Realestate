import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Validation } from "../Validation";

describe("Validation", () => {
  const props = {
    metrosValidated: 865,
    countiesValidated: 3061,
    zipsValidated: 25783,
    backtestYears: 22,
    dollarAlpha: "$7,247",
    icStatement:
      "Out-of-sample information coefficient of 0.27 across 865 metros, positive in every validated year (2001-2023).",
    outperformanceStatement:
      "Top-band PropertyIQ markets have outperformed bottom-band markets in the same state by about 1.7 percentage points per year over the following 3 years (out-of-sample, excess vs state).",
    hitRateStatement: "positive in 100% of validated years",
    limitedData: false,
  };

  it("renders limited-data branch when limitedData=true", () => {
    render(<Validation {...props} limitedData={true} />);
    expect(
      screen.getByText(/validation data unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders geo-level validated counts, not a per-market claim", () => {
    render(<Validation {...props} />);
    expect(screen.getByText(/3,061 counties/)).toBeInTheDocument();
    expect(screen.getByText(/25,783 ZIPs/)).toBeInTheDocument();
  });

  it("renders the sanctioned IC and dollar-alpha statements", () => {
    render(<Validation {...props} />);
    expect(
      screen.getByText(/information coefficient of 0\.27/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$7,247/)).toBeInTheDocument();
  });

  it("never claims accuracy 'in this metro'", () => {
    const { container } = render(<Validation {...props} />);
    expect(container.textContent ?? "").not.toMatch(/in this metro/i);
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Validation {...props} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
