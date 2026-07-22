import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

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

import {
  SavedAnalysesPanel,
  SAVED_ANALYSES_QUERY_KEY,
} from "../SavedAnalysesPanel";
import { fetchSavedAnalyses } from "@/lib/data";

function withQueryClient(children: ReactNode, qc: QueryClient) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("SavedAnalysesPanel", () => {
  it("lists saved analyses linking to /analyzer/saved/[id]", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container, getByRole } = render(
      withQueryClient(<SavedAnalysesPanel />, qc),
    );
    await waitFor(() => {
      expect(getByRole("button", { name: /saved analyses/i })).toBeTruthy();
    });
    fireEvent.click(getByRole("button", { name: /saved analyses/i }));
    expect(
      container.querySelector('a[href="/analyzer/saved/sa-1"]'),
    ).toBeTruthy();
  });

  it("refetches and shows a freshly saved row after its query is invalidated (regression: panel used to only fetch once on mount)", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const mockFetch = vi.mocked(fetchSavedAnalyses);
    mockFetch.mockResolvedValueOnce([
      {
        id: "sa-1",
        label: "123 Main St",
        address_city: "Austin",
        address_state: "TX",
        created_at: "2026-07-01T00:00:00Z",
      },
    ] as never);

    const { getByRole, findByText } = render(
      withQueryClient(<SavedAnalysesPanel />, qc),
    );
    await waitFor(() => {
      expect(
        getByRole("button", { name: /saved analyses \(1\)/i }),
      ).toBeTruthy();
    });

    // Simulate what AnalyzerHeaderActions.saveSnapshot() does after a
    // successful Share/PDF/Notes-save: invalidate the shared query key.
    mockFetch.mockResolvedValueOnce([
      {
        id: "sa-1",
        label: "123 Main St",
        address_city: "Austin",
        address_state: "TX",
        created_at: "2026-07-01T00:00:00Z",
      },
      {
        id: "sa-2",
        label: "456 Oak Ave",
        address_city: "Dallas",
        address_state: "TX",
        created_at: "2026-07-22T00:00:00Z",
      },
    ] as never);
    await qc.invalidateQueries({ queryKey: SAVED_ANALYSES_QUERY_KEY });

    expect(await findByText(/Saved analyses \(2\)/i)).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /saved analyses \(2\)/i }));
    expect(await findByText("456 Oak Ave")).toBeTruthy();
  });
});
