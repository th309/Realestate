import { describe, it, expect, beforeAll, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("../../lib/api-client", () => ({
  fetchApi: vi.fn(async (url: string) => {
    // Return deterministic fake market data; the math we're freezing is INDEPENDENT
    // of these returns (mortgage formula, GRM, cap rate from rent input).
    if (url.includes("/market-snapshot/")) {
      return { home_value: 425_000, rent_index: 2_950, propertyiq_score: 73 };
    }
    if (url.includes("/scores/")) return { score: 73, label: "GOOD" };
    return null;
  }),
}));

import { investorTools } from "../investors";

const FIXTURE_PATH = path.join(
  __dirname,
  "__fixtures__",
  "investors-golden.json",
);

const cases = [
  {
    tool: "cashflow_estimate",
    args: { zip: "78704", purchase_price: 425_000 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "78704", purchase_price: 425_000, down_pct: 25 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "90210", purchase_price: 1_500_000, down_pct: 30 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "50001", purchase_price: 120_000, down_pct: 100 },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "zip",
      geo_id: "78704",
      purchase_price: 425_000,
      monthly_rent: 2_950,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "metro",
      geo_id: "35620",
      purchase_price: 600_000,
      monthly_rent: 2_000,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "county",
      geo_id: "06037",
      purchase_price: 800_000,
      monthly_rent: 4_500,
      down_pct: 35,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "zip",
      geo_id: "50001",
      purchase_price: 100_000,
      monthly_rent: 1_200,
    },
  },
];

function findTool(name: string) {
  const t = investorTools.find((x: any) => x.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t;
}

describe("MCP investor tools — golden parity", () => {
  let golden: Record<string, any> = {};
  beforeAll(() => {
    if (fs.existsSync(FIXTURE_PATH)) {
      golden = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
    }
  });

  it.each(cases)("preserves output for $tool $args", async ({ tool, args }) => {
    const handler = findTool(tool).handler;
    const result = await handler(args);
    const key = `${tool}::${JSON.stringify(args)}`;

    if (process.env.UPDATE_GOLDEN === "1") {
      golden[key] = JSON.parse(result);
      fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
      fs.writeFileSync(FIXTURE_PATH, JSON.stringify(golden, null, 2));
      return;
    }

    expect(golden[key]).toBeDefined();
    expect(JSON.parse(result)).toEqual(golden[key]);
  });
});
