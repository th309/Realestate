/**
 * Builds the server-rendered FAQ set for market pages (metro / county / ZIP).
 *
 * Each answer leads with the direct answer in its first sentence and is written
 * to be self-contained and quotable (the target for AI-answer / rich-result
 * surfaces). Every question is data-gated: a question whose underlying stat is
 * null is skipped entirely rather than padded (MarketFaqSection then drops the
 * whole block if fewer than 3 survive).
 *
 * The PropertyIQ Score is framed strictly as a demand-MOMENTUM / timing signal,
 * NOT a quality grade — answers reframe "good/bad market" questions accordingly
 * and use the canonical getScoreLabel() for the momentum word (CLAUDE.md §9).
 */
import { formatMetricValue } from "@/lib/data";
import type { MarketStatsData } from "@/lib/data";
import { getScoreLabel } from "@/app/components/scoring/score-labels";
import { statYear } from "@/lib/seo/market-metadata";

export type MarketGeoLabel = "metro area" | "county" | "ZIP code";

export interface MarketFaq {
  question: string;
  answer: string;
}

export interface BuildMarketFaqsInput {
  displayName: string;
  geoLabel: MarketGeoLabel;
  stats: MarketStatsData | null;
}

/** "June 2026" from a period date, or null when unparseable. */
function monthYear(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** A score receipt's value (already in display units), or null. */
function receiptValue(stats: MarketStatsData, key: string): number | null {
  const r = stats.receipts.find((x) => x.key === key);
  return r && r.value !== null ? r.value : null;
}

/** Percent value to one decimal, sign-free (e.g. 5.2 -> "5.2%"). */
function pct(v: number): string {
  return `${Math.abs(v).toFixed(1)}%`;
}

/**
 * The market's stance vs its own state + the buyer implication, in four bands
 * around the 50 = state-average calibration. Momentum-framed, never quality.
 */
function momentumRead(score: number): {
  stateStance: string;
  buyerNote: string;
} {
  if (score >= 60)
    return {
      stateStance:
        "positioned to outperform its state over the next three years",
      buyerNote:
        "For buyers, strengthening demand usually means rising competition and firmer prices, so waiting can cost you negotiating room.",
    };
  if (score >= 50)
    return {
      stateStance: "tracking close to its state average",
      buyerNote:
        "For buyers, a balanced market means neither side holds a decisive edge, giving you time to shop carefully without racing the clock.",
    };
  if (score >= 40)
    return {
      stateStance:
        "positioned to lag its state modestly over the next three years",
      buyerNote:
        "For buyers, softening demand tends to open up negotiating room as listings sit longer and price cuts become more common.",
    };
  return {
    stateStance: "positioned to lag its state over the next three years",
    buyerNote:
      "For buyers, cooling demand usually brings more inventory, longer sale times, and real leverage to negotiate on price.",
  };
}

/** Q1 — reframes "good place to buy?" as a momentum-vs-state read. */
function buildBuyQuestion(
  input: BuildMarketFaqsInput,
  price: number | null,
  yoy: number | null,
): MarketFaq | null {
  const { displayName, stats } = input;
  if (!stats || stats.score === null) return null;
  const score = stats.score;
  const { stateStance, buyerNote } = momentumRead(score);
  const labelText = getScoreLabel(score).toLowerCase();

  const parts: string[] = [
    "PropertyIQ doesn't label markets simply good or bad.",
    "Instead, the PropertyIQ Score measures a market's demand momentum against its own state, where 50 marks the state average.",
    `${displayName} currently scores ${score}, a ${labelText}-momentum reading that leaves it ${stateStance}.`,
    buyerNote,
  ];

  if (price !== null) {
    const trend =
      yoy === null
        ? ""
        : yoy > 0
          ? `, up ${pct(yoy)} over the past year`
          : yoy < 0
            ? `, down ${pct(yoy)} over the past year`
            : ", essentially flat over the past year";
    parts.push(
      `Backing that up, the median home value here is ${formatMetricValue(price, "currency")}${trend}.`,
    );
  }

  parts.push(
    `So whether ${displayName} is right for you comes down to your goals: a rising-momentum market can favor long-term appreciation but offers less room to negotiate, while a cooling one hands buyers more leverage.`,
    "Treat the score as a timing signal to weigh alongside your budget, holding period, and plans for the property, not a verdict on the market's quality.",
  );

  return {
    question: `Is ${displayName} a good place to buy real estate in ${statYear(stats)}?`,
    answer: parts.join(" "),
  };
}

/** Q2 — what the score is, its inputs, and the 50 = state-average calibration. */
function buildScoreQuestion(input: BuildMarketFaqsInput): MarketFaq | null {
  const { displayName, stats } = input;
  if (!stats || stats.score === null) return null;
  const score = stats.score;
  const labelText = getScoreLabel(score).toLowerCase();
  const rel = score > 50 ? "above" : score < 50 ? "below" : "right at";

  const answer = [
    `${displayName}'s PropertyIQ Score is ${score}, indicating ${labelText} momentum on a 1-to-99 scale.`,
    "The score distills four transparent inputs into a single number: Zillow home-value momentum over the past 12 months, Zillow home-value momentum over the past 3 months, the median days homes spend on the market from Realtor.com, and the share of listings with a price cut, also from Realtor.com.",
    "Rising values and faster sales push the score up, while slow sales and frequent price cuts pull it down.",
    "The scale is calibrated so 50 equals the state average, meaning a score above 50 predicts the market will outperform its state over the next three years and a score below 50 predicts underperformance.",
    `PropertyIQ computes the score across every US market nationally, then recenters it against each state, so ${score} places ${displayName} ${rel} its state benchmark.`,
  ].join(" ");

  return {
    question: `What is the PropertyIQ Score for ${displayName}?`,
    answer,
  };
}

/** Q3 — price direction from ZHVI 12-mo and 3-mo momentum. */
function buildPriceTrendQuestion(
  input: BuildMarketFaqsInput,
  price: number | null,
  yoy: number | null,
  mom3: number | null,
): MarketFaq | null {
  const { displayName, geoLabel, stats } = input;
  if (!stats || (yoy === null && mom3 === null)) return null;

  const dir = (v: number) =>
    v > 0 ? "rising" : v < 0 ? "falling" : "holding roughly flat";
  const sentences: string[] = [
    `Home prices in ${displayName} are ${dir(yoy ?? (mom3 as number))}.`,
  ];

  if (yoy !== null) {
    const move =
      yoy > 0
        ? `increased ${pct(yoy)}`
        : yoy < 0
          ? `declined ${pct(yoy)}`
          : "were essentially unchanged";
    const reaching =
      price !== null
        ? `, reaching ${formatMetricValue(price, "currency")}`
        : "";
    sentences.push(
      `Over the past year, the median home value ${move}${reaching}.`,
    );
  } else if (price !== null) {
    sentences.push(
      `The median home value currently stands at ${formatMetricValue(price, "currency")}.`,
    );
  }

  if (mom3 !== null) {
    const near =
      mom3 > 0
        ? `values moved up ${pct(mom3)}, a sign near-term demand remains firm`
        : mom3 < 0
          ? `values slipped ${pct(mom3)}, a sign near-term demand is softening`
          : "values were essentially flat, a sign near-term demand has leveled off";
    sentences.push(`Over the latest three months, ${near}.`);
  }

  sentences.push(
    "PropertyIQ derives these figures from Zillow's home-value index, which tracks the typical value across the market rather than only the homes that happened to sell, giving a steadier read than a raw median sale price.",
    `Both the 12-month and 3-month momentum readings feed directly into the PropertyIQ Score, so this price trend is one of the core signals behind ${displayName}'s current score.`,
    `Keep in mind that appreciation can vary widely by neighborhood and price tier across the ${geoLabel}, so treat these figures as the market-wide baseline rather than a guarantee for any single property.`,
  );

  return {
    question: `Are home prices in ${displayName} rising or falling?`,
    answer: sentences.join(" "),
  };
}

/** Q4 — how fast homes sell, plus the price-cut share when available. */
function buildSaleSpeedQuestion(
  input: BuildMarketFaqsInput,
  dom: number | null,
  priceCut: number | null,
): MarketFaq | null {
  const { displayName, stats } = input;
  if (!stats || dom === null) return null;

  const sentences: string[] = [
    `In ${displayName}, homes sell in a median of ${Math.round(dom)} days from listing to pending sale, based on Realtor.com market data.`,
    "Median days on market is one of the clearest real-time reads on local demand: when homes move quickly, buyers are competing and sellers hold the advantage, while lengthening timelines signal cooling interest and more room to negotiate.",
  ];

  if (priceCut !== null) {
    sentences.push(
      `Alongside sale speed, about ${Math.round(priceCut)}% of active listings here have taken at least one price cut — a complementary demand gauge, since a rising share of reductions often precedes slower sales and softer prices.`,
      "Both median days on market and the price-cut share feed directly into the PropertyIQ Score, where faster sales and fewer cuts push the score higher.",
    );
  } else {
    sentences.push(
      "Median days on market feeds directly into the PropertyIQ Score, where faster sales push the score higher and slower sales pull it down.",
    );
  }

  sentences.push(
    "As a general guide, medians under about 30 days indicate a brisk, competitive market, while medians well beyond 60 days point to buyers regaining leverage.",
    "Actual time on market still varies by price band, property type, and season, so treat the median as a market-wide baseline.",
  );

  return {
    question: `How quickly do homes sell in ${displayName}?`,
    answer: sentences.join(" "),
  };
}

/** Q5 — data freshness, sources, and the monthly rescore (always available). */
function buildDataCurrencyQuestion(input: BuildMarketFaqsInput): MarketFaq {
  const { displayName, geoLabel, stats } = input;
  const asOf = monthYear(stats?.latestDate ?? null);

  const opening = asOf
    ? `This ${displayName} market data is refreshed on a monthly cycle, with the latest figures current through ${asOf}.`
    : `This ${displayName} market data is refreshed on a monthly cycle, with new figures published as each underlying source updates.`;

  const answer = [
    opening,
    "PropertyIQ ingests fresh data every month from a range of authoritative sources: home values and rents from Zillow, days on market and price-cut activity from Realtor.com, additional housing signals from Redfin, demographic and housing-stock data from the U.S. Census Bureau, mortgage and macroeconomic series from FRED, and employment figures from the Bureau of Labor Statistics and the Bureau of Economic Analysis.",
    "The PropertyIQ Score itself is recomputed every month once the new source data lands, so the score and its four underlying inputs always reflect the most recent complete reporting period rather than a static snapshot.",
    "Because official housing data is typically released with a short lag, the current-through date usually trails the present by a few weeks, which is normal across the industry and not a sign the data is out of date.",
  ].join(" ");

  return { question: `How current is this ${geoLabel} data?`, answer };
}

/**
 * Assemble the market FAQ set. Skips any question whose data is null; returns
 * only the survivors (MarketFaqSection renders nothing when fewer than 3).
 */
export function buildMarketFaqs(input: BuildMarketFaqsInput): MarketFaq[] {
  const { stats } = input;
  const price = stats?.headline.medianPrice.value ?? null;
  const yoy = stats?.headline.yoy.value ?? null;
  const dom = stats?.headline.daysOnMarket.value ?? null;
  const mom3 = stats ? receiptValue(stats, "zhvi_mom_3m") : null;
  const priceCut = stats ? receiptValue(stats, "price_reduced_share") : null;

  const faqs: (MarketFaq | null)[] = [
    buildBuyQuestion(input, price, yoy),
    buildScoreQuestion(input),
    buildPriceTrendQuestion(input, price, yoy, mom3),
    buildSaleSpeedQuestion(input, dom, priceCut),
    buildDataCurrencyQuestion(input),
  ];

  return faqs.filter((f): f is MarketFaq => f !== null);
}
