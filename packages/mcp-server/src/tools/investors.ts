import { z } from "zod";
import { fetchApi } from "../lib/api-client";

async function getMarketData(geography: string, geoId: string) {
  const [snapshot, score] = await Promise.all([
    fetchApi(`/api/market-snapshot/${geography}/${geoId}`).catch(() => null),
    fetchApi(`/api/scores/${geography}/${geoId}`, { historyMonths: 3 }).catch(
      () => null,
    ),
  ]);
  return { snapshot, score };
}

export const investorTools = [
  {
    name: "cashflow_estimate",
    description:
      "Quick back-of-napkin cashflow model using live rent and home value data. Estimates monthly cashflow, cap rate, and cash-on-cash return.",
    schema: {
      zip: z.string().describe("ZIP code"),
      purchase_price: z.number().describe("Purchase price in dollars"),
      down_pct: z
        .number()
        .optional()
        .describe("Down payment percentage (default 20)"),
    },
    handler: async (args: any) => {
      const [snapshot, rents] = await Promise.all([
        fetchApi(`/api/market-snapshot/zip/${args.zip}`).catch(() => null),
        fetchApi(`/api/scores/zip/${args.zip}`).catch(() => null),
      ]);
      const price = args.purchase_price;
      const downPct = (args.down_pct || 20) / 100;
      const downPayment = price * downPct;
      const loanAmount = price - downPayment;
      const monthlyRate = 0.07 / 12; // ~7% rate estimate
      const months = 360;
      const monthlyMortgage =
        (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
        (Math.pow(1 + monthlyRate, months) - 1);
      const estimatedTaxInsurance = (price * 0.015) / 12; // ~1.5% annually
      const estimatedMaintenance = (price * 0.01) / 12; // ~1% annually
      const totalMonthlyExpenses =
        monthlyMortgage + estimatedTaxInsurance + estimatedMaintenance;

      return JSON.stringify(
        {
          market_data: snapshot,
          purchase_assumptions: {
            purchase_price: price,
            down_payment: downPayment,
            loan_amount: loanAmount,
            estimated_rate: "7%",
            monthly_mortgage: Math.round(monthlyMortgage),
            monthly_tax_insurance: Math.round(estimatedTaxInsurance),
            monthly_maintenance: Math.round(estimatedMaintenance),
            total_monthly_expenses: Math.round(totalMonthlyExpenses),
          },
          instructions:
            "Calculate cashflow using the rent data from market_data. Show: gross rent, total expenses, net monthly cashflow, annual cashflow, cap rate (NOI/price), and cash-on-cash return (annual cashflow/down payment). Include a plain-language verdict.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "top_cashflow_markets",
    description:
      "Find markets with the best rent-to-price ratio in a state. High ratio = better cashflow potential.",
    schema: {
      state: z.string().describe("2-letter state code"),
      geography: z
        .enum(["metro", "zip"])
        .optional()
        .describe("Geography level (default metro)"),
      limit: z.number().optional().describe("Number of results (default 10)"),
    },
    handler: async (args: any) => {
      const geo = args.geography || "metro";
      const geoPath = geo === "metro" ? "metros" : "zips";
      const [homeValues, rents] = await Promise.all([
        fetchApi(`/api/zillow/${geoPath}`, { state: args.state }).catch(() => ({
          data: [],
        })),
        fetchApi(`/api/zillow/rent/${geoPath}`, { state: args.state }).catch(
          () => ({ data: [] }),
        ),
      ]);
      return JSON.stringify(
        {
          home_values: homeValues,
          rent_data: rents,
          state: args.state,
          limit: args.limit || 10,
          instructions:
            "Match each market's rent to its home value. Calculate rent-to-price ratio (annual rent / price). Rank by ratio descending. Show top results with: name, home value, monthly rent, annual yield %, and PropertyIQ score if available.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "appreciation_vs_cashflow_matrix",
    description:
      "Position markets on a 2x2 quadrant: high/low appreciation vs high/low cashflow. Classic investor decision framework.",
    schema: {
      geography: z.enum(["metro", "county"]).describe("Geography level"),
      geo_ids: z.string().describe("Comma-separated geography IDs to compare"),
    },
    handler: async (args: any) => {
      const ids = args.geo_ids.split(",").map((s: string) => s.trim());
      const results = await Promise.all(
        ids.map(async (id: string) => ({
          geo_id: id,
          ...(await getMarketData(args.geography, id)),
        })),
      );
      return JSON.stringify(
        {
          markets: results,
          instructions:
            "Position each market on a 2x2 matrix: X-axis = cashflow (rent/price ratio), Y-axis = appreciation (YoY price change). Label quadrants: Growth (high appreciation, low cashflow), Balanced (high/high), Cashflow (low appreciation, high cashflow), Avoid (low/low). Include a table and recommendation.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "deal_analyzer",
    description:
      "Analyze a specific deal: GRM, cap rate estimate, cash-on-cash, and a plain-language verdict.",
    schema: {
      geography: z
        .enum(["metro", "county", "zip"])
        .describe("Geography level for market context"),
      geo_id: z.string().describe("Geography ID for market context"),
      purchase_price: z.number().describe("Purchase price"),
      monthly_rent: z.number().describe("Expected monthly rent"),
      down_pct: z.number().optional().describe("Down payment % (default 20)"),
    },
    handler: async (args: any) => {
      const snapshot = await fetchApi(
        `/api/market-snapshot/${args.geography}/${args.geo_id}`,
      ).catch(() => null);
      const price = args.purchase_price;
      const rent = args.monthly_rent;
      const annualRent = rent * 12;
      const grm = price / annualRent;
      const expenses = annualRent * 0.4; // 40% expense ratio estimate
      const noi = annualRent - expenses;
      const capRate = (noi / price) * 100;
      const downPct = (args.down_pct || 20) / 100;
      const downPayment = price * downPct;
      const loanAmount = price - downPayment;
      const annualDebtService = loanAmount * 0.07; // simplified
      const cashflow = noi - annualDebtService;
      const cocReturn = (cashflow / downPayment) * 100;

      return JSON.stringify(
        {
          deal_metrics: {
            purchase_price: price,
            monthly_rent: rent,
            annual_rent: annualRent,
            grm: grm.toFixed(1),
            estimated_noi: Math.round(noi),
            cap_rate: capRate.toFixed(1) + "%",
            cash_on_cash: cocReturn.toFixed(1) + "%",
            annual_cashflow: Math.round(cashflow),
          },
          market_context: snapshot,
          instructions:
            "Analyze this deal. Compare GRM and cap rate to market averages. Give a verdict: Strong Buy, Buy, Hold, or Pass. Explain why in 2-3 sentences.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "market_cycle_position",
    description:
      "Assess where a market is in the real estate cycle: recovery, expansion, hyper-supply, or recession.",
    schema: {
      geography: z.enum(["metro", "county"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, timeseries] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`, {
          historyMonths: 6,
        }).catch(() => null),
        fetchApi(
          `/api/timeseries/home_value/${args.geography}/${args.geo_id}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          price_history: timeseries,
          instructions:
            "Determine market cycle position based on: price trend direction, inventory levels, DOM trends, and new construction. Classify as Recovery (prices bottoming, low inventory), Expansion (prices rising, moderate building), Hyper-Supply (prices peaking, lots of building), or Recession (prices falling, high inventory). Explain your reasoning.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "short_term_rental_viability",
    description:
      "Assess STR/Airbnb viability based on tourism signals, income levels, and rental trends.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, demographics] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(
          `/api/census/median-income/${args.geography === "zip" ? "zips" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          income_data: demographics,
          instructions:
            "Assess STR viability. Consider: median income (higher = more business travel), rent levels (opportunity cost of LTR), home prices (entry cost), and market competition. Rate as High/Medium/Low viability with reasoning.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "portfolio_diversification_score",
    description:
      "Assess geographic concentration risk across an investor's holdings.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_ids: z
        .string()
        .describe("Comma-separated geography IDs in portfolio"),
    },
    handler: async (args: any) => {
      const ids = args.geo_ids.split(",").map((s: string) => s.trim());
      const results = await Promise.all(
        ids.map(async (id: string) => ({
          geo_id: id,
          ...(await getMarketData(args.geography, id)),
        })),
      );
      return JSON.stringify(
        {
          portfolio_markets: results,
          count: ids.length,
          instructions:
            "Analyze diversification. Flag: same-state concentration, correlated markets (similar economies), and single-score-range clustering. Suggest markets that would improve diversification. Score overall diversification A-F.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "exchange_1031_targets",
    description:
      "Find top replacement property markets for a 1031 exchange, ranked by PropertyIQ score with rationale.",
    schema: {
      origin_geography: z
        .enum(["metro", "county", "zip"])
        .describe("Origin geography level"),
      origin_id: z.string().describe("Origin market ID"),
      limit: z.number().optional().describe("Number of targets (default 10)"),
    },
    handler: async (args: any) => {
      const [originData, topMarkets] = await Promise.all([
        getMarketData(args.origin_geography, args.origin_id),
        fetchApi("/api/scores/top", {
          geography: "metro",
          score_type: "propertyiq",
          limit: args.limit || 10,
        }).catch(() => []),
      ]);
      return JSON.stringify(
        {
          origin_market: originData,
          replacement_candidates: topMarkets,
          instructions:
            "Recommend 1031 exchange targets. For each: name, PropertyIQ score, key metrics, and why it's a good replacement. Consider: different state for tax diversification, higher score for appreciation potential, similar or better cashflow profile.",
        },
        null,
        2,
      );
    },
  },
];
