import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => true }),
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/lib/export", () => ({ downloadCsv: () => {} }));
vi.mock("../../config", () => ({
  getMetricFormat: () => "number",
  getMetricTitle: () => "Test Metric",
}));
vi.mock("@/lib/data", () => ({
  formatMetricValue: (v: number | null) => String(v),
}));
vi.mock("../../types", () => ({
  getValueFromEntry: (e: any) => e.value,
  getDateFromEntry: (e: any) => e.date ?? null,
}));

import { DataTableModal } from "../DataTableModal";

describe("DataTableModal rows", () => {
  it("navigates to /market/<id>?type=<geoLevel> and closes on row click", () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <DataTableModal
        isOpen
        onClose={onClose}
        mapData={{ "12420": { value: 5, name: "Austin" } } as any}
        selectedMetric="home_value"
        geoLevel={"metro" as any}
      />,
    );
    fireEvent.click(getByText("Austin"));
    expect(push).toHaveBeenCalledWith("/market/12420?type=metro");
    expect(onClose).toHaveBeenCalled();
  });
});
