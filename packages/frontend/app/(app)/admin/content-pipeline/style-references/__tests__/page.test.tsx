import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StyleReferencesPage from "../page";
import { ToastProvider } from "../../lib/toast";
import type { StyleReference } from "../../lib/style-refs-api";
import type {
  SavedStyleRef,
  StylePreferences,
} from "../../lib/style-preferences";

vi.mock("../../lib/style-refs-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStyleReferences: vi.fn(),
  createStyleReference: vi.fn(),
  ingestVideoUrl: vi.fn(),
  uploadVideoReference: vi.fn(),
  reExtractStyleReference: vi.fn(),
  deleteStyleReference: vi.fn(),
}));
vi.mock("../../lib/style-preferences-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStylePreferences: vi.fn(),
  saveStylePreference: vi.fn(),
  unsaveStylePreference: vi.fn(),
  setStyleSignalWeight: vi.fn(),
}));

import { fetchStyleReferences } from "../../lib/style-refs-api";
import {
  fetchStylePreferences,
  saveStylePreference,
  unsaveStylePreference,
} from "../../lib/style-preferences-api";

function ref(id: string, label: string, kind: string): StyleReference {
  return {
    id,
    user_id: "user-1",
    kind,
    label,
    source_url: "https://example.invalid/a.png",
    preview_strip_url: null,
    extracted_attributes: {},
    vision_cost_usd: 0,
    created_at: "2026-07-28T00:00:00.000Z",
  };
}

function saved(id: string): SavedStyleRef {
  return {
    style_reference_id: id,
    label: id,
    saved_at: "2026-07-28T00:00:00.000Z",
    exists: true,
    palette: [],
    typography: [],
    layout: [],
    summary: "",
  };
}

function prefs(savedIds: string[]): StylePreferences {
  return {
    brandId: "brand-1",
    signalWeight: 1,
    savedStyleRefs: savedIds.map(saved),
    stylePreamble: "",
  };
}

const REFERENCES = [
  ref("doom-img", "Doom-Data Alarm (Graham thumbnail)", "thumbnail"),
  ref("doom-vid", "Doom-Data Alarm sample video (Graham)", "video"),
  ref("bold-img", "Bold-Type Hook (yellow blocks)", "thumbnail"),
  ref("bold-vid", "Bold-Type Hook sample video (headline)", "video"),
];

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <StyleReferencesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchStyleReferences).mockResolvedValue(REFERENCES);
  vi.mocked(saveStylePreference).mockImplementation(async (id) =>
    prefs([`saved-after-${id}`]),
  );
  vi.mocked(unsaveStylePreference).mockResolvedValue(prefs([]));
});

describe("StyleReferencesPage group star saves the whole style", () => {
  it("saves only the group's unsaved references, skipping the already-saved one", async () => {
    vi.mocked(fetchStylePreferences).mockResolvedValue(prefs(["doom-img"]));
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use Doom-Data Alarm for generation",
      }),
    );

    await waitFor(() =>
      expect(saveStylePreference).toHaveBeenCalledWith("doom-vid"),
    );
    expect(saveStylePreference).toHaveBeenCalledTimes(1);
    expect(saveStylePreference).not.toHaveBeenCalledWith("doom-img");
    expect(unsaveStylePreference).not.toHaveBeenCalled();
  });

  it("unsaves every reference in a fully-steering group and no others", async () => {
    vi.mocked(fetchStylePreferences).mockResolvedValue(
      prefs(["doom-img", "doom-vid"]),
    );
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Stop using Doom-Data Alarm for generation",
      }),
    );

    await waitFor(() => expect(unsaveStylePreference).toHaveBeenCalledTimes(2));
    expect(unsaveStylePreference).toHaveBeenCalledWith("doom-img");
    expect(unsaveStylePreference).toHaveBeenCalledWith("doom-vid");
    expect(unsaveStylePreference).not.toHaveBeenCalledWith("bold-img");
    expect(saveStylePreference).not.toHaveBeenCalled();
  });

  it("refetches preferences and surfaces an error when the save loop fails midway", async () => {
    vi.mocked(fetchStylePreferences).mockResolvedValue(prefs([]));
    vi.mocked(saveStylePreference)
      .mockResolvedValueOnce(prefs(["doom-img"]))
      .mockRejectedValueOnce(new Error("boom"));
    renderPage();

    const fetchesBeforeClick = vi.mocked(fetchStylePreferences).mock.calls
      .length;
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use Doom-Data Alarm for generation",
      }),
    );

    expect(
      await screen.findByText(/Could not update: boom/),
    ).toBeInTheDocument();
    // onError invalidates the preferences query so the star reflects the
    // server's partially-saved state instead of the optimistic one.
    await waitFor(() =>
      expect(
        vi.mocked(fetchStylePreferences).mock.calls.length,
      ).toBeGreaterThan(fetchesBeforeClick),
    );
  });
});
