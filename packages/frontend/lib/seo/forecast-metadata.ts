import { formatMetricValue } from "@/lib/data";
import type { MarketStatsData } from "@/lib/data";
import { forecastDisplayYear } from "./forecast-year";

export function buildForecastTitle(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = forecastDisplayYear(stats?.latestDate ?? null);
  return `${name} Housing Market Forecast ${year}: Will Prices Drop?`;
}

export function buildForecastDescription(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = forecastDisplayYear(stats?.latestDate ?? null);
  if (!stats || stats.score === null) {
    return `${name} housing market forecast for ${year}, built from demand-momentum data: price trends, days on market, and price cuts. Not speculation.`;
  }
  const bits: string[] = [`PropertyIQ Score ${stats.score}`];
  if (stats.grade) bits.push(`confidence ${stats.grade}`);
  const price = stats.headline.medianPrice.value;
  if (price !== null)
    bits.push(`${formatMetricValue(price, "currency")} median`);
  return `${name} housing market forecast for ${year}: ${bits.join(", ")}. A momentum-based outlook from real market data, not speculation.`;
}
