import { describe, it, expect } from "vitest";
import {
  buildAnalyzerSnapshot,
  type AnalyzerSnapshotDerived,
  type AnalyzerSnapshotState,
} from "../build-analyzer-snapshot";
import type { RichResultSnapshot } from "../analyzer-snapshot-types";

/**
 * Regression: the "My Notes" Save button persists via the existing
 * POST /api/analyzer/save flow by riding along inside `result_snapshot`.
 * These tests pin that notes + shareNotes reach the save payload (and only
 * the snapshot blob, so no backend DTO/migration is required).
 */
describe("buildAnalyzerSnapshot — notes", () => {
  const baseState: AnalyzerSnapshotState = {
    address: "123 Main St, Austin, TX 78704",
    analyzer: { input: { price: 300000 }, rental: {}, flip: null, brrrr: null },
    rentcastData: null,
    marketContext: null,
  };
  const derived: AnalyzerSnapshotDerived = {
    displayAddress: "123 Main St, Austin, TX 78704",
    subjectLat: null,
    subjectLon: null,
    paramZip: undefined,
  };

  it("carries notes + shareNotes into result_snapshot", () => {
    const payload = buildAnalyzerSnapshot(baseState, derived, {
      notes: "Seller motivated, follow up Tuesday.",
      shareNotes: true,
    });
    const snap = payload.result_snapshot as unknown as RichResultSnapshot;
    expect(snap.notes).toBe("Seller motivated, follow up Tuesday.");
    expect(snap.shareNotes).toBe(true);
  });

  it("leaves notes undefined when none were entered", () => {
    const payload = buildAnalyzerSnapshot(baseState, derived, {});
    const snap = payload.result_snapshot as unknown as RichResultSnapshot;
    expect(snap.notes).toBeUndefined();
    expect(snap.shareNotes).toBeUndefined();
  });

  it("notes do NOT leak into a top-level payload field (no DTO change needed)", () => {
    const payload = buildAnalyzerSnapshot(baseState, derived, {
      notes: "private",
      shareNotes: false,
    });
    expect((payload as Record<string, unknown>).notes).toBeUndefined();
    expect((payload as Record<string, unknown>).shareNotes).toBeUndefined();
  });
});
