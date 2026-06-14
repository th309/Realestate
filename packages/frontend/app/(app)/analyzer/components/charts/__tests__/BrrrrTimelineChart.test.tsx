import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BrrrrTimelineChart } from "../BrrrrTimelineChart";

describe("BrrrrTimelineChart", () => {
  const phases = [
    { id: "buy" as const, label: "Buy", monthStart: 0, monthEnd: 0 },
    { id: "rehab" as const, label: "Rehab", monthStart: 0, monthEnd: 3 },
    { id: "lease" as const, label: "Lease", monthStart: 3, monthEnd: 4 },
    { id: "season" as const, label: "Season", monthStart: 4, monthEnd: 10 },
    { id: "refi" as const, label: "Refi", monthStart: 10, monthEnd: 11 },
    {
      id: "stabilized" as const,
      label: "Stabilized",
      monthStart: 11,
      monthEnd: null,
    },
  ];

  it("renders 6 phase nodes", () => {
    const { container } = render(<BrrrrTimelineChart phases={phases} />);
    expect(container.querySelectorAll("[data-brrrr-phase]").length).toBe(6);
  });

  it("renders all phase labels", () => {
    const { getByText } = render(<BrrrrTimelineChart phases={phases} />);
    expect(getByText("Buy")).toBeTruthy();
    expect(getByText("Stabilized")).toBeTruthy();
  });
});
