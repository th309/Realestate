/**
 * Tests for the streaming CSV pipeline (redfin-dc-streaming.ts).
 *
 * Uses an in-memory Readable so no HTTP or DB calls are made.
 * batchUpsert is mocked to record its call arguments.
 */

import { Readable } from "stream";
import {
  runStreamingPipeline,
  PIPELINE_BATCH_SIZE,
} from "../redfin-dc-streaming";
import * as batchUpsertModule from "../../../lib/batch-upsert";
import { getDashboard } from "../redfin-dc-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCsvStream(rows: string[]): Readable {
  const csv = rows.join("\n") + "\n";
  return Readable.from([csv]);
}

const HEADER =
  "PERIOD BEGIN,PERIOD END,REGION TYPE,REGION NAME,FREQUENCY,LAST UPDATED,PRICE DROPS";

function makeRow(
  regionName: string,
  periodEnd: string,
  priceDrops: string | number = "100",
): string {
  return `2026-01-01,${periodEnd},Metro,${regionName},monthly,2026-05-01,${priceDrops}`;
}

// Fake geo resolver: always resolves successfully.
const fakeResolve = jest
  .fn()
  .mockResolvedValue({ regionId: "10420", resolved: true });

// Target config from price_drops/metro — has all the columns we need.
const DASH = getDashboard("price_drops");
const TARGET = DASH.geos.metro;
const KNOWN_COLUMNS = getDashboard("price_drops").geos.metro
  ? new Set([
      "region_id",
      "region_name",
      "period_begin",
      "period_end",
      "frequency",
      "last_updated",
      "price_drops",
    ])
  : new Set<string>();

// Minimal supabase stub — only used by mapRowToRecord's resolve call which we
// intercept via jest.mock below.
const FAKE_SUPABASE = {} as any;

// ---------------------------------------------------------------------------
// Mock mapRowToRecord to inject our fake resolver without wiring real Supabase
// ---------------------------------------------------------------------------

jest.mock("../redfin-dc-csv-processor", () => {
  const actual = jest.requireActual("../redfin-dc-csv-processor");
  return {
    ...actual,
    mapRowToRecord: (
      supabase: any,
      row: any,
      geoLevel: string,
      target: any,
      knownColumns: any,
    ) =>
      actual.mapRowToRecord(
        supabase,
        row,
        geoLevel,
        target,
        knownColumns,
        fakeResolve,
      ),
  };
});

// ---------------------------------------------------------------------------
// Mock batchUpsert to record calls and return a successful result
// ---------------------------------------------------------------------------

const upsertCalls: Array<{
  records: Record<string, unknown>[];
  tableName: string;
}> = [];

jest
  .spyOn(batchUpsertModule, "batchUpsert")
  .mockImplementation(async (_supabase, records, options) => {
    upsertCalls.push({ records: [...records], tableName: options.tableName });
    return { inserted: records.length, failed: 0, errors: [] };
  });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  upsertCalls.length = 0;
  fakeResolve.mockClear();
});

describe("runStreamingPipeline — batch flushing", () => {
  it("flushes at PIPELINE_BATCH_SIZE boundaries and a final partial batch", async () => {
    // Use a tiny batchSize of 2 so we can reason about flush boundaries with
    // a 5-row CSV without needing thousands of rows.
    const BATCH_SIZE = 2;
    const rows = [
      HEADER,
      makeRow("Akron, OH metro area", "2026-04-30"),
      makeRow("Austin, TX metro area", "2026-04-30"),
      makeRow("Boston, MA metro area", "2026-04-30"),
      makeRow("Chicago, IL metro area", "2026-04-30"),
      makeRow("Denver, CO metro area", "2026-04-30"),
    ];

    const result = await runStreamingPipeline({
      supabase: FAKE_SUPABASE,
      stream: makeCsvStream(rows),
      target: TARGET,
      geoLevel: "metro",
      knownColumns: KNOWN_COLUMNS,
      dateCutoff: null,
      rowLimit: undefined,
      upsertBatchSize: BATCH_SIZE,
    });

    // 5 rows → 2 full batches of 2 + 1 partial of 1 = 3 upsert calls
    expect(upsertCalls).toHaveLength(3);
    expect(upsertCalls[0].records).toHaveLength(2);
    expect(upsertCalls[1].records).toHaveLength(2);
    expect(upsertCalls[2].records).toHaveLength(1);

    expect(result.totalRowsLoaded).toBe(5);
    expect(result.recordsInserted).toBe(5);
    expect(result.recordsFailed).toBe(0);
    expect(result.rowsSkippedByMapping).toBe(0);
    expect(result.latestPeriodDate).toBe("2026-04-30");
  });

  it("emits a single batch when row count is below batch size", async () => {
    const rows = [
      HEADER,
      makeRow("Akron, OH metro area", "2026-03-31"),
      makeRow("Austin, TX metro area", "2026-04-30"),
    ];

    const result = await runStreamingPipeline({
      supabase: FAKE_SUPABASE,
      stream: makeCsvStream(rows),
      target: TARGET,
      geoLevel: "metro",
      knownColumns: KNOWN_COLUMNS,
      dateCutoff: null,
      rowLimit: undefined,
      upsertBatchSize: 10,
    });

    expect(upsertCalls).toHaveLength(1);
    expect(result.totalRowsLoaded).toBe(2);
    expect(result.recordsInserted).toBe(2);
    expect(result.latestPeriodDate).toBe("2026-04-30");
  });
});

describe("runStreamingPipeline — dateCutoff filter", () => {
  it("skips rows whose PERIOD END is before the cutoff", async () => {
    const rows = [
      HEADER,
      makeRow("Akron, OH metro area", "2025-12-31"), // before cutoff — excluded
      makeRow("Austin, TX metro area", "2026-01-31"), // before cutoff — excluded
      makeRow("Boston, MA metro area", "2026-03-31"), // on or after — included
      makeRow("Chicago, IL metro area", "2026-04-30"), // included
    ];

    const result = await runStreamingPipeline({
      supabase: FAKE_SUPABASE,
      stream: makeCsvStream(rows),
      target: TARGET,
      geoLevel: "metro",
      knownColumns: KNOWN_COLUMNS,
      dateCutoff: "2026-03-01",
      rowLimit: undefined,
      upsertBatchSize: 10,
    });

    // totalRowsLoaded counts all rows seen before the date filter
    expect(result.totalRowsLoaded).toBe(4);
    // Only 2 pass the cutoff
    expect(result.recordsInserted).toBe(2);
  });
});

describe("runStreamingPipeline — rowLimit", () => {
  it("stops processing rows after rowLimit is reached", async () => {
    const rows = [
      HEADER,
      makeRow("Akron, OH metro area", "2026-04-30"),
      makeRow("Austin, TX metro area", "2026-04-30"),
      makeRow("Boston, MA metro area", "2026-04-30"),
    ];

    const result = await runStreamingPipeline({
      supabase: FAKE_SUPABASE,
      stream: makeCsvStream(rows),
      target: TARGET,
      geoLevel: "metro",
      knownColumns: KNOWN_COLUMNS,
      dateCutoff: null,
      rowLimit: 2,
      upsertBatchSize: 10,
    });

    // rowLimit=2: rows 1 and 2 are processed (totalRowsLoaded reaches 1 then 2,
    // both ≤ limit). Row 3 increments totalRowsLoaded to 3 (> limit) and returns early.
    expect(result.totalRowsLoaded).toBe(3);
    expect(result.recordsInserted).toBe(2);
  });
});

describe("runStreamingPipeline — unresolved hard-fail", () => {
  it("throws when >10% of rows are geo-unresolvable", async () => {
    fakeResolve.mockResolvedValue({
      regionId: "REDFIN-METRO-X",
      resolved: false,
    });

    const rows = [
      HEADER,
      makeRow("Unknown City 1", "2026-04-30"),
      makeRow("Unknown City 2", "2026-04-30"),
      makeRow("Unknown City 3", "2026-04-30"),
    ];

    await expect(
      runStreamingPipeline({
        supabase: FAKE_SUPABASE,
        stream: makeCsvStream(rows),
        target: TARGET,
        geoLevel: "metro",
        knownColumns: KNOWN_COLUMNS,
        dateCutoff: null,
        rowLimit: undefined,
        upsertBatchSize: 10,
      }),
    ).rejects.toThrow(/unresolved/i);
  });
});

describe("runStreamingPipeline — empty CSV", () => {
  it("returns zero counts and does not call batchUpsert for an empty file", async () => {
    const rows = [HEADER]; // header only, no data rows

    const result = await runStreamingPipeline({
      supabase: FAKE_SUPABASE,
      stream: makeCsvStream(rows),
      target: TARGET,
      geoLevel: "metro",
      knownColumns: KNOWN_COLUMNS,
      dateCutoff: null,
      rowLimit: undefined,
      upsertBatchSize: 10,
    });

    expect(upsertCalls).toHaveLength(0);
    expect(result.totalRowsLoaded).toBe(0);
    expect(result.recordsInserted).toBe(0);
    expect(result.latestPeriodDate).toBeNull();
  });
});
