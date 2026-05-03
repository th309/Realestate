import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EmploymentBars } from "../EmploymentBars";

describe("EmploymentBars", () => {
  it("renders one row per Bar", () => {
    const rows = [
      { label: "Healthcare", value: 22, max: 100 },
      { label: "Financial", value: 18, max: 100 },
    ];
    const { getByText } = render(<EmploymentBars rows={rows} />);
    expect(getByText("Healthcare")).toBeInTheDocument();
    expect(getByText("Financial")).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    const { getByText } = render(<EmploymentBars rows={[]} />);
    expect(getByText(/sector data unavailable/i)).toBeInTheDocument();
  });

  it("clamps bar widths to 0-100%", () => {
    const rows = [{ label: "A", value: 200, max: 100 }];
    const { container } = render(<EmploymentBars rows={rows} />);
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("uses default '%' suffix when not provided", () => {
    const rows = [{ label: "A", value: 50, max: 100 }];
    const { getByText } = render(<EmploymentBars rows={rows} />);
    expect(getByText("50%")).toBeInTheDocument();
  });

  it("uses custom suffix when provided", () => {
    const rows = [{ label: "A", value: 50, max: 100, suffix: "k" }];
    const { getByText } = render(<EmploymentBars rows={rows} />);
    expect(getByText("50k")).toBeInTheDocument();
  });
});
