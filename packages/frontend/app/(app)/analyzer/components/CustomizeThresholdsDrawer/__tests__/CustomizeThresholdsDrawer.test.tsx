import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BALANCED_THRESHOLDS } from "@propertyiq/analyzer-core";

// Mock the data-layer module so the drawer doesn't try to hit network.
const fetchThresholds = vi.fn();
const updateThresholds = vi.fn();
const deleteThresholds = vi.fn();
const fetchAnalyzerDefaults = vi.fn();
const updateAnalyzerDefaults = vi.fn();

vi.mock("@/lib/data", async () => {
  const { useQuery, useMutation, useQueryClient } =
    await import("@tanstack/react-query");
  return {
    useThresholds: (strategy: string) =>
      useQuery({
        queryKey: ["thresholds", strategy],
        queryFn: () => fetchThresholds(strategy),
      }),
    useUpdateThresholds: (strategy: string) => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (body: unknown) => updateThresholds(strategy, body),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["thresholds", strategy] }),
      });
    },
    useDeleteThresholds: (strategy: string) => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: () => deleteThresholds(strategy),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["thresholds", strategy] }),
      });
    },
    useAnalyzerDefaults: () =>
      useQuery({
        queryKey: ["analyzer-defaults"],
        queryFn: () => fetchAnalyzerDefaults(),
      }),
    useUpdateAnalyzerDefaults: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (body: unknown) => updateAnalyzerDefaults(body),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["analyzer-defaults"] }),
      });
    },
  };
});

import { CustomizeThresholdsDrawer } from "../CustomizeThresholdsDrawer";

const baseDefaults = {
  vacancyPct: 0.05,
  maintenancePct: 0.05,
  capexPct: 0.05,
  pmPct: 0.08,
  rentGrowthPct: 0.03,
  appreciationPct: 0.03,
  holdYears: 10,
  closingCostsPct: 0.03,
};

function renderDrawer(props: { open: boolean; onClose: () => void }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CustomizeThresholdsDrawer
        open={props.open}
        onClose={props.onClose}
        strategy="BUY_AND_HOLD"
      />
    </QueryClientProvider>,
  );
}

async function waitForLoaded() {
  await waitFor(() =>
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument(),
  );
}

beforeEach(() => {
  fetchThresholds.mockReset();
  updateThresholds.mockReset();
  deleteThresholds.mockReset();
  fetchAnalyzerDefaults.mockReset();
  updateAnalyzerDefaults.mockReset();
  fetchThresholds.mockResolvedValue(BALANCED_THRESHOLDS);
  fetchAnalyzerDefaults.mockResolvedValue(baseDefaults);
  updateThresholds.mockResolvedValue(BALANCED_THRESHOLDS);
  updateAnalyzerDefaults.mockResolvedValue(baseDefaults);
  deleteThresholds.mockResolvedValue({ ok: true });
});

describe("CustomizeThresholdsDrawer", () => {
  it("renders nothing when open=false", () => {
    renderDrawer({ open: false, onClose: vi.fn() });
    expect(
      screen.queryByTestId("customize-thresholds-drawer"),
    ).not.toBeInTheDocument();
  });

  it("renders header, tab nav and footer when open", async () => {
    renderDrawer({ open: true, onClose: vi.fn() });
    expect(
      screen.getByTestId("customize-thresholds-drawer"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customize Grading Thresholds"),
    ).toBeInTheDocument();
    // Tab labels
    expect(screen.getByRole("tab", { name: "Thresholds" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Weights" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Assumptions" }),
    ).toBeInTheDocument();
    // Footer buttons
    expect(screen.getByTestId("reset-all-button")).toBeInTheDocument();
    expect(screen.getByTestId("save-button")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("switches between tabs", async () => {
    renderDrawer({ open: true, onClose: vi.fn() });
    await waitForLoaded();
    // Thresholds tab is active first — row visible
    expect(screen.getByTestId("threshold-row-cashOnCash")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Weights" }));
    expect(screen.getByTestId("weights-sum-indicator")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Assumptions" }));
    expect(screen.getByTestId("assumption-row-vacancyPct")).toBeInTheDocument();
  });

  it("Cancel calls onClose immediately when not dirty", async () => {
    const onClose = vi.fn();
    renderDrawer({ open: true, onClose });
    await waitForLoaded();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel with dirty state shows the confirm strip", async () => {
    const onClose = vi.fn();
    renderDrawer({ open: true, onClose });
    await waitForLoaded();
    // Make something dirty: edit cashOnCash A.
    const aInput = screen.getByLabelText("Cash-on-Cash grade A");
    fireEvent.change(aInput, { target: { value: "20" } });

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByTestId("confirm-cancel-strip")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ESC fires the same Cancel logic", async () => {
    const onClose = vi.fn();
    renderDrawer({ open: true, onClose });
    await waitForLoaded();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Save calls the PUT mutation and shows success banner", async () => {
    renderDrawer({ open: true, onClose: vi.fn() });
    await waitForLoaded();
    // Edit one threshold so the save propagates with new data.
    const aInput = screen.getByLabelText("Cash-on-Cash grade A");
    fireEvent.change(aInput, { target: { value: "15" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-button"));
    });
    await waitFor(() => expect(updateThresholds).toHaveBeenCalledTimes(1));
    expect(updateAnalyzerDefaults).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("save-banner-success")).toBeInTheDocument(),
    );
  });

  it("Save is disabled when weights are invalid", async () => {
    renderDrawer({ open: true, onClose: vi.fn() });
    await waitForLoaded();
    fireEvent.click(screen.getByRole("tab", { name: "Weights" }));
    const w = screen.getByLabelText("Cash-on-Cash weight");
    // Knock the sum off 100.
    fireEvent.change(w, { target: { value: "10" } });
    expect(screen.getByTestId("save-button")).toBeDisabled();
  });

  it("Reset all calls DELETE then re-seeds form state", async () => {
    renderDrawer({ open: true, onClose: vi.fn() });
    await waitForLoaded();
    await act(async () => {
      fireEvent.click(screen.getByTestId("reset-all-button"));
    });
    await waitFor(() => expect(deleteThresholds).toHaveBeenCalledTimes(1));
    // After reset, success banner appears.
    await waitFor(() =>
      expect(screen.getByTestId("save-banner-success")).toHaveTextContent(
        /Reset to defaults/,
      ),
    );
    // Initial fetch + post-invalidate refetch.
    await waitFor(() =>
      expect(fetchThresholds.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
  });
});
