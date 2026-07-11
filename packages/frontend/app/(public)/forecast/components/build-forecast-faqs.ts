import type { MarketFaq } from "@/app/markets/components/build-market-faqs";
import type { MarketStatsData } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import { getScoreLabel } from "@/app/components/scoring/score-labels";

/** Momentum phrasing per CLAUDE.md section 9 labels — never quality verdicts. */
function momentumPhrase(score: number): string {
  const label = getScoreLabel(score).toLowerCase();
  return score >= 50 && score < 60
    ? `${label} demand momentum, in line with its state average`
    : `${label} demand momentum`;
}

export function buildForecastFaqs({
  displayName,
  stats,
}: {
  displayName: string;
  stats: MarketStatsData | null;
}): MarketFaq[] {
  if (!stats || stats.score === null) return [];
  const year = forecastDisplayYear(stats.latestDate);
  const grade = stats.grade ? ` (confidence grade ${stats.grade})` : "";
  const faqs: MarketFaq[] = [];

  faqs.push({
    question: `Will ${displayName} home prices crash in ${year}?`,
    answer: `Momentum data does not predict prices, but it shows direction. ${displayName} has a PropertyIQ Score of ${stats.score}${grade}, indicating ${momentumPhrase(stats.score)}. A score of 50 equals the market's state average. PropertyIQ does not publish price-crash predictions; it tracks the demand signals that historically move first: price momentum, days on market, and the share of listings with price cuts.`,
  });

  faqs.push({
    question: `What is the ${displayName} PropertyIQ Score?`,
    answer: `${displayName} currently scores ${stats.score} out of 99${grade}. The PropertyIQ Score measures demand momentum from four inputs: 12-month price momentum, 3-month price momentum, median days on market, and price-reduced share. It is calibrated so 50 equals the state average, and it is refreshed monthly.`,
  });

  const dom = stats.headline.daysOnMarket.value;
  if (dom !== null) {
    faqs.push({
      question: `How fast are homes selling in ${displayName}?`,
      answer: `The median listing in ${displayName} currently spends ${formatMetricValue(dom, "days")} on the market. Days on market is one of the four inputs to the PropertyIQ Score: shorter times signal firming demand, longer times signal easing demand.`,
    });
  }

  const yoy = stats.headline.yoy.value;
  if (yoy !== null) {
    faqs.push({
      question: `Are ${displayName} home prices rising or falling right now?`,
      answer: `Over the last year, ${displayName} home values ${yoy >= 0 ? "rose" : "fell"} ${formatMetricValue(Math.abs(yoy), "percent_abs")}. That is measured history, not a forecast; the PropertyIQ Score combines it with days-on-market and price-cut data to read where demand is heading.`,
    });
  }

  return faqs;
}
