import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  fetchSavedAnalyses: vi.fn().mockResolvedValue([
    {
      id: "sa-1",
      label: "123 Main St",
      address_city: "Austin",
      address_state: "TX",
      created_at: "2026-07-01T00:00:00Z",
    },
  ]),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { SavedAnalysesPanel } from "../SavedAnalysesPanel";

describe("SavedAnalysesPanel", () => {
  it("lists saved analyses linking to /analyzer/saved/[id]", async () => {
    const { container, getByRole } = render(<SavedAnalysesPanel />);
    await waitFor(() => {
      expect(getByRole("button", { name: /saved analyses/i })).toBeTruthy();
    });
    fireEvent.click(getByRole("button", { name: /saved analyses/i }));
    expect(
      container.querySelector('a[href="/analyzer/saved/sa-1"]'),
    ).toBeTruthy();
  });
});
