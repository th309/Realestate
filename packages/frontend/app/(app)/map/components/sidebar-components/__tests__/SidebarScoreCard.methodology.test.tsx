import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/app/components/scoring/ScoreDisplay", () => ({
  ScoreDisplay: () => <div />,
}));
vi.mock("../Icons", () => ({ InsightsIcon: () => <svg /> }));
vi.mock("./TrendArrow", () => ({
  TrendArrow: () => <span />,
  getTrendDirection: () => "flat",
  formatTrendValue: () => "—",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { SidebarScoreCard } from "../SidebarScoreCard";

describe("SidebarScoreCard", () => {
  it("links to methodology without triggering the card onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <SidebarScoreCard
        score={{ score: 72, access: "full" }}
        onClick={onClick}
      />,
    );
    const link = container.querySelector(
      'a[href="/scores/methodology"]',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });
});
