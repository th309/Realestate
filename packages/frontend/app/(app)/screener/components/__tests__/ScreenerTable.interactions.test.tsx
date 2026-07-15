import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/data", () => ({
  formatMetricValue: (v: number | null) => String(v),
  formatGeoDisplayName: (s: string) => s,
}));
vi.mock("../ScreenerRowMenu", () => ({
  ScreenerRowMenu: () => <div data-testid="row-menu" />,
}));

import { ScreenerTable } from "../ScreenerTable";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  state_code: "TX",
  score: 72,
  grade: "A",
  confidence: 90,
  median_price: 450000,
  home_value: 460000,
  rent: 1800,
  cap_rate: 5.1,
  gross_yield: 6,
  rent_to_price_ratio: 0.5,
  grm: 12,
  months_of_supply: 2.3,
  overvalued_pct: 8.4,
  score_chg_1m: 1,
  score_chg_3m: 2,
  score_chg_6m: 3,
  score_chg_1y: 4,
  score_chg_3y: 5,
  score_chg_5y: 6,
  population: 1000000,
  as_of: "2026-05-31",
  refreshed_at: "2026-06-01",
} as any;

const baseProps = {
  rows: [row],
  sortBy: "score" as const,
  sortOrder: "desc" as const,
  page: 0,
  pageSize: 50,
  isFetching: false,
  onSort: vi.fn(),
};

describe("ScreenerTable interactions", () => {
  it("navigates to the market page when a row is clicked", () => {
    render(<ScreenerTable {...baseProps} />);
    fireEvent.click(screen.getByText("Austin, TX"));
    expect(push).toHaveBeenCalledWith(
      "/market/12420?type=metro&view=investor&state=TX",
    );
  });

  it("opens the row action menu from the kebab button", () => {
    render(<ScreenerTable {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Row actions"));
    expect(screen.getByTestId("row-menu")).toBeTruthy();
  });
});
