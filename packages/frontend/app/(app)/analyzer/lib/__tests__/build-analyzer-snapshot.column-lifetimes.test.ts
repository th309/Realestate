import { describe, it, expect } from "vitest";
import {
  buildDealStatePayload,
  buildPublishedArtifact,
  type AnalyzerSnapshotDerived,
  type AnalyzerSnapshotState,
} from "../build-analyzer-snapshot";
import { DEAL_STATE_VERSION } from "../deal-state-types";
import { makeDealState } from "./deal-state-fixture";

/**
 * The saved row has three columns with three different lifetimes. One
 * builder used to write all three, which made "may this button republish a
 * link already in a client's hands?" a property of call sites. These pin the
 * lifetimes now that it is a property of the builders.
 *
 *  - `input_snapshot`  — every write path, always a versioned DealStateV2
 *  - `result_snapshot` — Share/PDF only
 *  - `market_context`  — the write that CREATES the row, then never again
 */

const state: AnalyzerSnapshotState = {
  address: "  123 Main St  ",
  analyzer: {
    input: { price: 300000 },
    rental: { capRatePct: 6.1 },
    flip: null,
    brrrr: null,
  },
  rentcastData: {
    property_record: { city: "Austin", state: "TX", zip: "78704" },
  },
  marketContext: { geo_level: "zip", geo_id: "78704" },
};

const derived: AnalyzerSnapshotDerived = {
  displayAddress: "123 Main St, Austin, TX 78704",
  subjectLat: 30.25,
  subjectLon: -97.75,
  paramZip: undefined,
};

const dealState = makeDealState({
  input: { price: 300000 } as never,
  label: "Duplex on 5th",
  analysisMode: "compare",
  notes: "Seller motivated.",
});

describe("input_snapshot is the versioned deal state, on every path", () => {
  it("a Save writes DealStateV2 — not the bare DealInput", () => {
    const payload = buildDealStatePayload(dealState, state, derived);
    expect(payload.input_snapshot.v).toBe(DEAL_STATE_VERSION);
    expect(payload.input_snapshot.analysisMode).toBe("compare");
    // The v1 bug: a bare DealInput has `price` at the top level and loses
    // analysisMode/thresholds/provenance entirely.
    expect(payload.input_snapshot.price).toBeUndefined();
  });

  it("a Share/PDF writes the SAME state blob a Save does", () => {
    const saved = buildDealStatePayload(dealState, state, derived);
    const published = buildPublishedArtifact(dealState, state, derived);
    expect(published.input_snapshot).toEqual(saved.input_snapshot);
  });

  it("the published artifact still echoes a FLAT DealInput for the share page", () => {
    const published = buildPublishedArtifact(dealState, state, derived);
    const snap = published.result_snapshot as { input?: { price?: number } };
    expect(snap.input?.price).toBe(300000);
  });
});

describe("result_snapshot belongs to Share/PDF alone", () => {
  it("a Save payload has no result_snapshot and no ai_verdict", () => {
    const payload = buildDealStatePayload(dealState, state, derived, {
      id: "row-1",
    });
    expect(payload).not.toHaveProperty("result_snapshot");
    expect(payload).not.toHaveProperty("ai_verdict");
  });

  it("a publish payload carries both", () => {
    const payload = buildPublishedArtifact(
      dealState,
      state,
      derived,
      { aiNarratives: { recommendation_analysis: "Strong cashflow." } },
      { id: "row-1" },
    );
    expect(payload.result_snapshot).toBeTruthy();
    expect(payload.ai_verdict).toEqual({
      recommendation_analysis: "Strong cashflow.",
    });
  });
});

describe("market_context is captured once, when the row is created", () => {
  it("the creating save (no id) captures it", () => {
    const payload = buildDealStatePayload(dealState, state, derived);
    expect(payload.market_context).toEqual({
      geo_level: "zip",
      geo_id: "78704",
    });
  });

  it("a re-save OMITS the key rather than sending null", () => {
    // Sending `null` would erase the stored capture on every save; omitting
    // the key leaves the backend's spread with nothing to write.
    const payload = buildDealStatePayload(dealState, state, derived, {
      id: "row-1",
    });
    expect(payload).not.toHaveProperty("market_context");
  });

  it("a re-publish does not re-capture it either", () => {
    const payload = buildPublishedArtifact(
      dealState,
      state,
      derived,
      {},
      {
        id: "row-1",
      },
    );
    expect(payload).not.toHaveProperty("market_context");
  });
});

describe("identity columns", () => {
  it("projects the deal name out of the state blob onto the label column", () => {
    const payload = buildDealStatePayload(dealState, state, derived);
    expect(payload.label).toBe("Duplex on 5th");
    expect(payload.input_snapshot.label).toBe("Duplex on 5th");
  });

  it("saves an unnamed deal as a null label, not as the string 'null'", () => {
    const payload = buildDealStatePayload(
      makeDealState({ label: null }),
      state,
      derived,
    );
    expect(payload.label).toBeNull();
  });

  it("prefers the RentCast-resolved address parts over the typed address", () => {
    const payload = buildDealStatePayload(dealState, state, derived);
    expect(payload.address_city).toBe("Austin");
    expect(payload.address_state).toBe("TX");
    expect(payload.address_zip).toBe("78704");
    expect(payload.address_full).toBe("123 Main St, Austin, TX 78704");
    expect(payload.lat).toBe(30.25);
  });

  it("falls back to the trimmed typed address when RentCast resolved nothing", () => {
    const payload = buildDealStatePayload(
      dealState,
      { ...state, rentcastData: null },
      { ...derived, paramZip: "78704" },
    );
    expect(payload.address_city).toBe("123 Main St");
    expect(payload.address_zip).toBe("78704");
  });

  it("omits `id` entirely on a first save so the backend upserts by address", () => {
    expect(buildDealStatePayload(dealState, state, derived)).not.toHaveProperty(
      "id",
    );
    expect(
      buildDealStatePayload(dealState, state, derived, { id: "row-1" }).id,
    ).toBe("row-1");
  });
});
