import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { AutoKillFlag } from "@propertyiq/analyzer-core";
import { AutoKillBanner } from "../AutoKillBanner";

describe("AutoKillBanner", () => {
  it("renders nothing when autoKills is empty", () => {
    const { container } = render(<AutoKillBanner autoKills={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading, items, and subtext for 2 auto-kills", () => {
    const kills: AutoKillFlag[] = [
      { code: "DSCR_BELOW_1", message: "DSCR is below 1.0" },
      { code: "NEGATIVE_CF", message: "Cashflow is negative" },
    ];
    const { container, getByText } = render(
      <AutoKillBanner autoKills={kills} />,
    );
    expect(getByText("Auto-Kill Triggered")).toBeTruthy();
    expect(container.querySelectorAll("[data-auto-kill-item]").length).toBe(2);
    expect(container.querySelector("[data-auto-kill-subtext]")).toBeTruthy();
    expect(getByText("DSCR is below 1.0")).toBeTruthy();
    expect(getByText("Cashflow is negative")).toBeTruthy();
  });

  it("has role=alert on wrapper", () => {
    const kills: AutoKillFlag[] = [{ code: "X", message: "Bad deal" }];
    const { container } = render(<AutoKillBanner autoKills={kills} />);
    const banner = container.querySelector("[data-auto-kill-banner]");
    expect(banner?.getAttribute("role")).toBe("alert");
  });
});
