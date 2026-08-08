import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalyzerHeaderActions } from "../AnalyzerHeaderActions";
import { saveDealState, publishAnalysis } from "@/lib/data/fetchers/analyzer";
import { fetchBatchedAiInsights } from "@/lib/data";
import { makeDealState } from "../../../lib/__tests__/deal-state-fixture";

vi.mock("@/lib/data/fetchers/analyzer", () => ({
  saveDealState: vi.fn(),
  publishAnalysis: vi.fn(),
  downloadAnalysisPdf: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  fetchBatchedAiInsights: vi.fn().mockResolvedValue(null),
  fetchSavedAnalyses: vi.fn().mockResolvedValue([]),
}));

/**
 * Regression guard for the whole class of bug the builder split exists to
 * kill: an explicit Save (or a Notes "Save") writing `result_snapshot`.
 *
 * `result_snapshot` is the frozen artifact the public share link and the PDF
 * render from. Before the split, every button funnelled through one
 * `saveSnapshot()` that wrote it, so clicking "Save deal" on a shared deal
 * silently republished the link — and pre-awaited an LLM batch call to do it.
 *
 * The payload types make that a compile error now; these pin the runtime
 * behaviour too, since a type can be cast away but a test cannot.
 */
describe("AnalyzerHeaderActions — Save must not publish", () => {
  const dealState = makeDealState({
    input: { price: 300000 } as never,
    label: "Duplex on 5th",
  });

  function renderActions(props: { dealId?: string | null } = {}) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrap = (children: ReactNode) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return render(
      wrap(
        <AnalyzerHeaderActions
          isPro
          state={{
            address: "200 Orlando Ave",
            analyzer: { input: {}, rental: {}, flip: null, brrrr: null },
            rentcastData: null,
            marketContext: { geo_level: "zip", geo_id: "61761" },
          }}
          derived={{
            displayAddress: "200 Orlando Ave, Normal, IL 61761",
            subjectLat: null,
            subjectLon: null,
            paramZip: undefined,
          }}
          dealState={dealState}
          aiPayload={{ input: {}, result: {} } as never}
          headingLabel="200 Orlando Ave"
          {...props}
        />,
      ),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveDealState).mockResolvedValue({
      id: "row-1",
      share_token: "tok-1",
    });
    vi.mocked(publishAnalysis).mockResolvedValue({
      id: "row-1",
      share_token: "tok-1",
    });
    vi.mocked(fetchBatchedAiInsights).mockClear();
  });

  it("routes the Save button to saveDealState, never to publishAnalysis", async () => {
    const { getByRole } = renderActions({ dealId: "row-1" });

    fireEvent.click(getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveDealState).toHaveBeenCalledTimes(1));
    expect(publishAnalysis).not.toHaveBeenCalled();
  });

  it("sends no result_snapshot and no ai_verdict when saving", async () => {
    const { getByRole } = renderActions({ dealId: "row-1" });

    fireEvent.click(getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveDealState).toHaveBeenCalled());
    const payload = vi.mocked(saveDealState).mock.calls[0][0];
    expect(payload).not.toHaveProperty("result_snapshot");
    expect(payload).not.toHaveProperty("ai_verdict");
    // …and it is the versioned state, which is the other half of the bug:
    // the legacy path wrote a bare DealInput here.
    expect(payload.input_snapshot.v).toBe(2);
  });

  it("fires no LLM batch call when saving", async () => {
    const { getByRole } = renderActions({ dealId: "row-1" });

    fireEvent.click(getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveDealState).toHaveBeenCalled());
    expect(fetchBatchedAiInsights).not.toHaveBeenCalled();
  });

  it("re-saving an existing row omits market_context so the capture survives", async () => {
    const { getByRole } = renderActions({ dealId: "row-1" });

    fireEvent.click(getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveDealState).toHaveBeenCalled());
    expect(vi.mocked(saveDealState).mock.calls[0][0]).not.toHaveProperty(
      "market_context",
    );
  });

  it("the Notes 'save now' handle is a state save too, not a publish", async () => {
    let saveNow: (() => Promise<boolean>) | null = null;
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <AnalyzerHeaderActions
          isPro
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
          dealState={dealState}
          dealId="row-1"
          headingLabel="200 Orlando Ave"
          onRegisterSave={(fn) => {
            if (fn) saveNow = fn;
          }}
        />
      </QueryClientProvider>,
    );

    expect(saveNow).toBeTypeOf("function");
    await expect(saveNow!()).resolves.toBe(true);
    expect(saveDealState).toHaveBeenCalledTimes(1);
    expect(publishAnalysis).not.toHaveBeenCalled();
  });
});

describe("AnalyzerHeaderActions — Share/PDF still publish", () => {
  const dealState = makeDealState({ input: { price: 300000 } as never });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveDealState).mockResolvedValue({
      id: "row-1",
      share_token: "tok-1",
    });
    vi.mocked(publishAnalysis).mockResolvedValue({
      id: "row-1",
      share_token: "tok-1",
    });
    vi.mocked(fetchBatchedAiInsights).mockClear();
  });

  it("Share writes the frozen artifact and pre-awaits the narratives", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { getByRole } = render(
      <QueryClientProvider client={qc}>
        <AnalyzerHeaderActions
          isPro
          state={{
            address: "200 Orlando Ave",
            analyzer: {
              input: {},
              rental: { capRatePct: 6.1 },
              flip: null,
              brrrr: null,
            },
            rentcastData: null,
            marketContext: null,
          }}
          derived={{
            displayAddress: "200 Orlando Ave, Normal, IL 61761",
            subjectLat: null,
            subjectLon: null,
            paramZip: undefined,
          }}
          dealState={dealState}
          dealId="row-1"
          aiPayload={{ input: {}, result: {} } as never}
          headingLabel="200 Orlando Ave"
        />
      </QueryClientProvider>,
    );

    fireEvent.click(getByRole("button", { name: /share/i }));

    await waitFor(() => expect(publishAnalysis).toHaveBeenCalledTimes(1));
    expect(fetchBatchedAiInsights).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(publishAnalysis).mock.calls[0][0];
    expect(payload.result_snapshot).toBeTruthy();
    expect(saveDealState).not.toHaveBeenCalled();
  });
});
