import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeoDrillBar } from "../GeoDrillBar";

describe("GeoDrillBar", () => {
  it("renders crumbs + tabs and fires the right handler", () => {
    const onCrumb = vi.fn();
    render(
      <GeoDrillBar
        crumbs={[
          { label: "United States", active: false, onClick: onCrumb },
          { label: "Texas", active: true, onClick: () => {} },
        ]}
        levelTabs={[
          { label: "State", enabled: true, active: false, onClick: () => {} },
          { label: "Metro", enabled: false, active: true, onClick: () => {} },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("United States"));
    expect(onCrumb).toHaveBeenCalled();
    expect(screen.getByText("Texas")).toBeTruthy();
    expect(screen.getByText("Metro")).toBeTruthy();
  });
});
