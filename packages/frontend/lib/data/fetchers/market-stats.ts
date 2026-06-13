// Server-side assembler for the SEO MarketStatsBlock.
// Pairs headline market data with the four PropertyIQ score "receipts" read
// straight from the score's stored z_scores (exposed as scores.propertyiq.components),
// so the receipts can never drift from the score itself.
import {
  fetchMarketSnapshot,
  type MarketSnapshotResponse,
} from "./market-snapshot";
import { fetchTimeSeriesData } from "./timeseries";
import type { TimeSeriesResult } from "../types";

export interface MarketStatField {
  metricId: string;
  label: string;
  value: number | null;
  source: string | null; // 'zillow' | 'realtor' | 'redfin' | 'census' | ...
  date: string | null; // period_date
}

export type ReceiptKey =
  | "zhvi_yoy"
  | "zhvi_mom_3m"
  | "median_days_on_market"
  | "price_reduced_share";

export interface ScoreReceipt {
  key: ReceiptKey;
  label: string;
  value: number | null;
  format: "percent" | "days";
}

export interface MarketStatsData {
  score: number | null;
  grade: string | null;
  headline: {
    medianPrice: MarketStatField;
    rent: MarketStatField;
    daysOnMarket: MarketStatField;
    yoy: MarketStatField;
  };
  receipts: ScoreReceipt[];
  sparkline: number[];
  latestDate: string | null;
}

const RECEIPT_DEFS: {
  key: ReceiptKey;
  label: string;
  format: "percent" | "days";
  scale: number;
}[] = [
  { key: "zhvi_yoy", label: "Home value YoY", format: "percent", scale: 100 },
  { key: "zhvi_mom_3m", label: "3-mo momentum", format: "percent", scale: 100 },
  {
    key: "median_days_on_market",
    label: "Days on market",
    format: "days",
    scale: 1,
  },
  {
    key: "price_reduced_share",
    label: "Price-reduced share",
    format: "percent",
    scale: 100,
  },
];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function assembleMarketStats(
  snapshot: MarketSnapshotResponse,
  timeseries: TimeSeriesResult | null,
): MarketStatsData {
  const piq = snapshot.scores?.propertyiq ?? null;
  const components = (piq?.components ?? {}) as Record<string, number | null>;

  const receipts: ScoreReceipt[] = RECEIPT_DEFS.map((def) => {
    const raw = num(components[def.key]);
    return {
      key: def.key,
      label: def.label,
      format: def.format,
      value: raw === null ? null : raw * def.scale,
    };
  });

  const price = snapshot.metrics?.home_value;
  const rent = snapshot.metrics?.rent_index;
  const yoyReceipt = receipts.find((r) => r.key === "zhvi_yoy")!;
  const domReceipt = receipts.find((r) => r.key === "median_days_on_market")!;

  const dates = [
    price?.date,
    rent?.date,
    snapshot.metrics?.days_on_market?.date,
    snapshot.lastUpdated,
  ]
    .filter((d): d is string => Boolean(d))
    .sort();
  const latestDate = dates.length ? dates[dates.length - 1] : null;

  return {
    score: piq ? Math.round(piq.score) : null,
    grade: piq?.grade ?? null,
    headline: {
      medianPrice: {
        metricId: "home_value",
        label: "Median Price",
        value: num(price?.value),
        source: price?.source ?? null,
        date: price?.date ?? null,
      },
      rent: {
        metricId: "rent_index",
        label: "Rent (ZORI)",
        value: num(rent?.value),
        source: rent?.source ?? null,
        date: rent?.date ?? null,
      },
      // YoY and DOM come from the score's own inputs so the headline can never
      // contradict the "what drives the score" receipts strip.
      daysOnMarket: {
        metricId: "days_on_market",
        label: "Median DOM",
        value: domReceipt.value,
        source: "realtor",
        date: snapshot.metrics?.days_on_market?.date ?? null,
      },
      yoy: {
        metricId: "home_value_yoy",
        label: "YoY",
        value: yoyReceipt.value,
        source: "zillow",
        date: price?.date ?? null,
      },
    },
    receipts,
    sparkline: (timeseries?.data ?? [])
      .map((p) => p.value)
      .filter((v): v is number => typeof v === "number"),
    latestDate,
  };
}

// Renamed from `fetchMarketStats` to avoid colliding with the existing
// `fetchMarketStats` exported from ./markets.
export async function fetchSeoMarketStats(
  geoType: "metro" | "county" | "zip",
  geoId: string,
  state?: string,
): Promise<MarketStatsData | null> {
  try {
    const [snapshot, timeseries] = await Promise.all([
      fetchMarketSnapshot(geoType, geoId, state),
      fetchTimeSeriesData("home_value", geoType, geoId, {
        historyMonths: 12,
      }).catch(() => null),
    ]);
    if (!snapshot?.success) return null;
    return assembleMarketStats(snapshot, timeseries);
  } catch {
    return null;
  }
}
