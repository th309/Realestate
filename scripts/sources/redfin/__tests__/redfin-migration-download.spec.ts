import { readFileSync } from "fs";
import { join } from "path";
import {
  parseRedfinMigrationTsv,
  splitMetroAndFlowRows,
} from "../redfin-migration-download";

const tsv = readFileSync(
  join(__dirname, "..", "__fixtures__", "redfin-migration-sample.tsv"),
  "utf-8",
);

describe("parseRedfinMigrationTsv", () => {
  it("parses TSV header columns and emits one row per data line", () => {
    const rows = parseRedfinMigrationTsv(tsv);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toHaveProperty("period_date");
    expect(rows[0]).toHaveProperty("cbsa_code");
  });

  it("preserves legitimate 0 values for net_searches and net_inflow (regression for parseInt(... || '0') bug)", () => {
    // Inline TSV: row 1 has net_searches=0 (real-world: aggregate self-pair),
    // row 2 has net_inflow=0 (zero net migration), row 3 has both non-zero.
    const inlineTsv = [
      "period_end\tdestination_metro\tdestination_metro_name\torigin_metro\torigin_metro_name\tnet_inflow\tinflow_share\toutflow_share\ttotal_users\tshare\tnet_searches",
      "2025-12-01\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t100\t50.00\t50.00\t10000\t100.00\t0",
      "2025-12-01\t35620\tNew York-Newark-Jersey City, NY-NJ-PA\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t0\t1.00\t1.00\t10000\t1.00\t250",
      "2025-12-01\t38060\tPhoenix-Mesa-Chandler, AZ\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t500\t2.00\t1.00\t10000\t2.00\t450",
    ].join("\n");

    const rows = parseRedfinMigrationTsv(inlineTsv);
    expect(rows).toHaveLength(3);

    // Row 0: net_searches must be 0, NOT undefined.
    expect(rows[0].net_searches).toBe(0);
    expect(rows[0].net_searches).not.toBeUndefined();

    // Row 1: net_inflow must be 0, NOT undefined.
    expect(rows[1].net_inflow).toBe(0);
    expect(rows[1].net_inflow).not.toBeUndefined();

    // Row 2: both non-zero, sanity check.
    expect(rows[2].net_inflow).toBe(500);
    expect(rows[2].net_searches).toBe(450);
  });

  it("normalises YYYY-MM period values to YYYY-MM-01 month start", () => {
    const inlineTsv = [
      "period_end\tdestination_metro\tdestination_metro_name\torigin_metro\torigin_metro_name\tnet_inflow\tinflow_share\toutflow_share\ttotal_users\tshare\tnet_searches",
      "2024-03\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t12060\tAtlanta-Sandy Springs-Alpharetta, GA\t100\t50.00\t50.00\t10000\t100.00\t0",
    ].join("\n");

    const rows = parseRedfinMigrationTsv(inlineTsv);
    expect(rows).toHaveLength(1);
    expect(rows[0].period_date).toBe("2024-03-01");
  });
});

describe("splitMetroAndFlowRows", () => {
  it("splits aggregate rows from origin/destination pair rows", () => {
    const rows = parseRedfinMigrationTsv(tsv);
    const { metroRows, flowRows } = splitMetroAndFlowRows(rows);
    // Aggregate rows have NO origin (or origin == destination)
    expect(metroRows.length).toBeGreaterThan(0);
    expect(flowRows.length).toBeGreaterThan(0);
    expect(flowRows[0]).toHaveProperty("origin_cbsa");
    expect(flowRows[0]).toHaveProperty("destination_cbsa");
  });
});
