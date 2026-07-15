import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MomentumDonut } from "../MomentumDonut";

describe("MomentumDonut", () => {
  it("buckets scores and shows legend counts", () => {
    render(<MomentumDonut scores={[80, 70, 50, 30]} unitPlural="metros" />);
    expect(screen.getByText(/Rising/)).toBeTruthy();
    expect(screen.getByText(/Steady/)).toBeTruthy();
    expect(screen.getByText(/Cooling/)).toBeTruthy();
  });
});
