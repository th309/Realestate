import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AnalyzerHeaderActions } from "../AnalyzerHeaderActions";
import { SavedAnalysesPanel } from "../../SavedAnalysesPanel";
import { saveAnalysis } from "@/lib/data/fetchers/analyzer";
import { fetchSavedAnalyses } from "@/lib/data";

vi.mock("@/lib/data/fetchers/analyzer", () => ({
  saveAnalysis: vi.fn(),
  downloadAnalysisPdf: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  fetchBatchedAiInsights: vi.fn().mockResolvedValue(null),
  fetchSavedAnalyses: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * Regression test for the reported bug: a user clicks the header Share
 * button, the save genuinely succeeds server-side, but the "Saved analyses"
 * panel (a sibling component, not a child) never reflected it without a
 * full page reload — it only fetched once on mount. Renders both real
 * components under one QueryClient (as they are on the actual page) so the
 * invalidate -> refetch wiring is exercised end-to-end, not just asserted
 * against a mocked call.
 */
describe("AnalyzerHeaderActions -> SavedAnalysesPanel list refresh", () => {
  it("refreshes the saved-analyses panel after a successful Share-button save", async () => {
    const mockSave = vi.mocked(saveAnalysis);
    mockSave.mockResolvedValue({ id: "row-1", share_token: "tok-123" });

    const mockFetchSaved = vi.mocked(fetchSavedAnalyses);
    mockFetchSaved.mockResolvedValueOnce([
      {
        id: "sa-1",
        label: "123 Main St",
        address_city: "Austin",
        address_state: "TX",
        created_at: "2026-07-01T00:00:00Z",
      },
    ] as never);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrap = (children: ReactNode) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { getByRole, findByText } = render(
      wrap(
        <>
          <AnalyzerHeaderActions
            isPro={true}
            state={{
              address: "200 Orlando Ave",
              analyzer: { input: {}, rental: {}, flip: null, brrrr: null },
              rentcastData: null,
              marketContext: null,
            }}
            derived={{
              displayAddress: "200 Orlando Ave, Normal, IL 61761",
              subjectLat: null,
              subjectLon: null,
              paramZip: undefined,
            }}
            headingLabel="200 Orlando Ave"
          />
          <SavedAnalysesPanel />
        </>,
      ),
    );

    // Panel starts with its initial fetch: 1 saved analysis.
    await waitFor(() => {
      expect(
        getByRole("button", { name: /saved analyses \(1\)/i }),
      ).toBeTruthy();
    });

    // Server now reflects the upcoming save as a second row.
    mockFetchSaved.mockResolvedValueOnce([
      {
        id: "sa-1",
        label: "123 Main St",
        address_city: "Austin",
        address_state: "TX",
        created_at: "2026-07-01T00:00:00Z",
      },
      {
        id: "row-1",
        label: null,
        address_full: "200 Orlando Ave, Normal, IL 61761",
        address_city: "Normal",
        address_state: "IL",
        created_at: "2026-07-22T00:00:00Z",
      },
    ] as never);

    fireEvent.click(getByRole("button", { name: /share/i }));

    // The click triggers saveSnapshot() -> saveAnalysis() -> success ->
    // queryClient.invalidateQueries() -> SavedAnalysesPanel refetches and
    // now shows 2, with no page reload and no direct call between the two
    // components.
    expect(await findByText(/Saved analyses \(2\)/i)).toBeTruthy();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
