import type {
  SingleMarketVideoProps,
  MarketStats,
  TrendDirection,
  MarketData,
  ComparisonMarket,
} from "../types";

export function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Coerce the MCP-shaped dataBundle into the shape the scenes need.
 * The payload comes from `ContentDataService.getMarketSnapshot` and has
 * the nested shape: { score, home_value, rent, demographics, economic, geo }.
 */
/**
 * Economic metrics for the long-form EconomicPulse scene (when trend history is sparse).
 */
export function coerceEconomic(bundle: Record<string, unknown>): {
  unemployment_rate: number;
  job_growth_yoy_pct: number;
} | null {
  const economic = (bundle.economic ?? {}) as {
    unemployment_rate?: number;
    job_growth_yoy_pct?: number;
  };
  const hasAny =
    typeof economic.unemployment_rate === "number" ||
    typeof economic.job_growth_yoy_pct === "number";
  if (!hasAny) return null;
  return {
    unemployment_rate: num(economic.unemployment_rate, 0),
    job_growth_yoy_pct: num(economic.job_growth_yoy_pct, 0),
  };
}

export function coerceStats(bundle: Record<string, unknown>): MarketStats {
  const homeValue = (bundle.home_value ?? {}) as {
    value?: number;
    yoy_pct?: number;
  };
  const rent = (bundle.rent ?? {}) as { value?: number };
  const demo = (bundle.demographics ?? {}) as {
    population?: number;
    median_income?: number;
    homeownership_pct?: number;
  };
  return {
    medianPrice: num(homeValue.value, 0),
    homeValueYoyPct: num(homeValue.yoy_pct, 0),
    homeownershipPct: num(demo.homeownership_pct, 0),
    population: num(demo.population, 0),
    medianIncome: num(demo.median_income, 0),
    medianRent: num(rent.value, 0),
  };
}

export function pickState(props: SingleMarketVideoProps): string {
  const fromBundle = (props.dataBundle as any)?.state;
  if (typeof fromBundle === "string" && fromBundle.length > 0)
    return fromBundle;
  const cn = props.resolvedMarket.canonical_name;
  const parts = cn.split(",").map((s: string) => s.trim());
  return parts.length > 1 ? parts[parts.length - 1] : cn;
}

export function coerceMarketData(raw: any, fallbackName: string): MarketData {
  const scoreObj = raw?.score ?? {};
  const score = num(scoreObj.propertyiq_score ?? raw?.propertyiq_score, 50);
  const grade =
    typeof scoreObj.grade === "string"
      ? scoreObj.grade
      : typeof raw?.grade === "string"
        ? raw.grade
        : "FAIR";
  const market =
    typeof raw?.canonical_name === "string"
      ? raw.canonical_name
      : typeof raw?.name === "string"
        ? raw.name
        : typeof raw?.market === "string"
          ? raw.market
          : fallbackName;
  // Trend isn't in the snapshot shape — same as GradeRevealLayout's stable/0 fallback.
  const trend: TrendDirection = "stable";
  const trendChange = 0;
  const periodDate =
    typeof raw?.home_value?.period_date === "string"
      ? raw.home_value.period_date
      : new Date().toISOString().slice(0, 10);
  const stats = coerceStats(raw ?? {});
  return {
    market,
    score,
    grade,
    trend,
    trendChange,
    stats,
    history: [],
    periodDate,
  };
}

export function coerceComparisonMarket(
  raw: any,
  fallbackName: string,
): ComparisonMarket {
  const m = coerceMarketData(raw, fallbackName);
  return {
    market: m.market,
    score: m.score,
    grade: m.grade,
    trend: m.trend,
    trendChange: m.trendChange,
  };
}
