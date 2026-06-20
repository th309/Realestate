/**
 * Frozen, REAL product-output captures for the Beat 7 persona showcase.
 *
 * Every number below is a genuine response from the live PropertyIQ MCP/API for
 * Austin ZIP 78704, captured 2026-05-31 — not fabricated, and not regenerated
 * per visitor (spec §6). Refresh cadence is manual (re-run the MCP tools and
 * paste). The "as of" date is shown on each panel per the data-attribution rule.
 */

export type StatTone = "pos" | "neg" | "neutral";

export type StatRow = {
  label: string;
  value: string;
  tone?: StatTone;
};

export type PersonaKey = "investor" | "agent" | "buyer" | "developer";

export type PersonaSnapshot = {
  key: PersonaKey;
  tabLabel: string;
  feature: string;
  market: string;
  verdict: { text: string; tone: "pos" | "neg" | "warn" };
  stats: StatRow[];
  caption: string;
};

const AS_OF = "as of 2026-05-31";

export const PERSONA_ORDER: PersonaKey[] = [
  "investor",
  "agent",
  "buyer",
  "developer",
];

export const PERSONA_SNAPSHOTS: Record<
  Exclude<PersonaKey, "developer">,
  PersonaSnapshot
> = {
  investor: {
    key: "investor",
    tabLabel: "Investor",
    feature: "Deal Analyzer",
    market: "Austin, TX · 78704",
    verdict: {
      text: "Pass — negative cash flow, ~116% overvalued",
      tone: "neg",
    },
    stats: [
      { label: "Purchase price", value: "$550,000" },
      { label: "Total monthly expenses", value: "$4,073/mo", tone: "neg" },
      { label: "Area median rent", value: "$1,849/mo" },
      { label: "Net cash flow", value: "−$2,224/mo", tone: "neg" },
      { label: "Cap rate", value: "1.61%", tone: "neg" },
      { label: "Overvalued vs. fundamentals", value: "+115.7%", tone: "neg" },
      { label: "PropertyIQ Score", value: "7 · F", tone: "neg" },
    ],
    caption: `Real output from the PropertyIQ Deal Analyzer · ${AS_OF}`,
  },
  agent: {
    key: "agent",
    tabLabel: "Agent",
    feature: "Listing presentation",
    market: "Austin, TX · 78704",
    verdict: {
      text: "Cooling + tight inventory — price it right or it sits",
      tone: "warn",
    },
    stats: [
      { label: "Median days on market", value: "57 days" },
      { label: "Price per sq ft", value: "$572" },
      { label: "Active inventory", value: "374 (−18.7% YoY)", tone: "neg" },
      { label: "New listings", value: "96 (−25% YoY)", tone: "neg" },
      { label: "Listings with price cuts", value: "23.4%", tone: "neg" },
      { label: "Home values", value: "−10.81% YoY", tone: "neg" },
    ],
    caption: `Real hyperlocal stats from PropertyIQ for agents · ${AS_OF}`,
  },
  buyer: {
    key: "buyer",
    tabLabel: "First-time buyer",
    feature: "Affordability",
    market: "Austin, TX · 78704",
    verdict: {
      text: "Buying needs 2.3× the local income — renting wins today",
      tone: "warn",
    },
    stats: [
      { label: "Median home price", value: "$733,554" },
      { label: "Income needed to buy", value: "$221,880", tone: "neg" },
      { label: "Median household income", value: "$97,160" },
      { label: "Affordable at median income", value: "$361,262" },
      { label: "Years to save a down payment", value: "17", tone: "neg" },
      { label: "Rent (area median)", value: "$1,849/mo" },
    ],
    caption: `Real output from PropertyIQ Affordability · ${AS_OF}`,
  },
};

/**
 * The power-user / developer panel: a genuine MCP exchange. The response below
 * is the real get_propertyiq_score result for 78704 (score 7, grade F, 3-month
 * trend −8), trimmed to the fields a person would read.
 */
export const MCP_EXCHANGE = {
  tabLabel: "Power user",
  feature: "Claude · MCP · API",
  question: "What's the PropertyIQ score for Austin's 78704?",
  toolCall: 'get_propertyiq_score(geography="zip", location_id="78704")',
  response: [
    "{",
    '  "location": "Austin, TX · 78704",',
    '  "score": 7,',
    '  "grade": "F",',
    '  "confidence": "A",',
    '  "trend_3mo": -8,',
    '  "signal": {',
    '    "price_momentum_yoy": "-1.1%",',
    '    "median_days_on_market": 57,',
    '    "price_cut_share": "23.4%"',
    "  }",
    "}",
  ].join("\n"),
  caption:
    "A real MCP tool call against live PropertyIQ data · as of 2026-05-31",
};
