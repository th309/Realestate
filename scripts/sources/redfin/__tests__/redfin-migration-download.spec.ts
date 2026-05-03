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
  it("parses TSV rows with non-zero share_pct values", () => {
    const rows = parseRedfinMigrationTsv(tsv);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toHaveProperty("period_date");
    expect(rows[0]).toHaveProperty("cbsa_code");
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
