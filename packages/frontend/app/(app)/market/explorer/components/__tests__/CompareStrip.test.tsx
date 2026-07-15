import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompareStrip } from "../CompareStrip";

const pins = [
  {
    id: "A",
    name: "Austin",
    sub: "Metro · TX",
    score: 61,
    scoreColor: "green",
    stats: [{ label: "Median value", value: "$455K", color: "x" }],
  },
];

describe("CompareStrip", () => {
  it("renders nothing when there are no pins", () => {
    const { container } = render(
      <CompareStrip pins={[]} onUnpin={() => {}} onClear={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
  it("renders pin cards and unpins on ✕", () => {
    const onUnpin = vi.fn();
    render(<CompareStrip pins={pins} onUnpin={onUnpin} onClear={() => {}} />);
    expect(screen.getByText("Austin")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove"));
    expect(onUnpin).toHaveBeenCalledWith("A");
  });
});
