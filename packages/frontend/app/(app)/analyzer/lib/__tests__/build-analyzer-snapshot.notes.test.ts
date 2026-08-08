import { describe, it, expect } from "vitest";
import {
  buildPublishedArtifact,
  buildDealStatePayload,
  type AnalyzerSnapshotDerived,
  type AnalyzerSnapshotState,
} from "../build-analyzer-snapshot";
import type { RichResultSnapshot } from "../analyzer-snapshot-types";
import { makeDealState } from "./deal-state-fixture";

/**
 * Notes ("My Notes" + the "Share with client" toggle) reach the saved row by
 * two different routes, and the difference is the point:
 *
 *  - `DealStateV2.notes` / `.shareNotes` — the owner's working copy, saved
 *    by the Save button and by autosave, restored when the deal reopens.
 *  - `result_snapshot.notes` / `.shareNotes` — the copy frozen into the
 *    published artifact, written only by Share/PDF, which is what the
 *    public link renders (gated on `shareNotes`).
 *
 * These pin that the published copy still rides inside the snapshot blob (no
 * backend DTO or migration needed) and that a plain Save cannot touch it.
 */
describe("published artifact — notes", () => {
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
  const dealState = makeDealState({ input: { price: 300000 } as never });

  it("carries notes + shareNotes into result_snapshot", () => {
    const payload = buildPublishedArtifact(dealState, baseState, derived, {
      notes: "Seller motivated, follow up Tuesday.",
      shareNotes: true,
    });
    const snap = payload.result_snapshot as unknown as RichResultSnapshot;
    expect(snap.notes).toBe("Seller motivated, follow up Tuesday.");
    expect(snap.shareNotes).toBe(true);
  });

  it("leaves notes undefined when none were entered", () => {
    const payload = buildPublishedArtifact(dealState, baseState, derived, {});
    const snap = payload.result_snapshot as unknown as RichResultSnapshot;
    expect(snap.notes).toBeUndefined();
    expect(snap.shareNotes).toBeUndefined();
  });

  it("notes do NOT leak into a top-level payload field (no DTO change needed)", () => {
    const payload = buildPublishedArtifact(dealState, baseState, derived, {
      notes: "private",
      shareNotes: false,
    });
    expect((payload as Record<string, unknown>).notes).toBeUndefined();
    expect((payload as Record<string, unknown>).shareNotes).toBeUndefined();
  });

  it("a Save carries the owner's notes in the state blob, not the artifact", () => {
    const payload = buildDealStatePayload(
      makeDealState({ notes: "Call the listing agent.", shareNotes: false }),
      baseState,
      derived,
    );
    expect(payload.input_snapshot.notes).toBe("Call the listing agent.");
    expect(payload.input_snapshot.shareNotes).toBe(false);
    expect(payload).not.toHaveProperty("result_snapshot");
  });
});
