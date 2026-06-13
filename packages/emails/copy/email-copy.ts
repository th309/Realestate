/**
 * Single source of truth for PropertyIQ marketing/lifecycle email copy.
 * Edit wording HERE; React templates and backend HTML builders import from this file.
 *
 * RULE: never hardcode validation statistics (dollar impact, hit rate, year counts)
 * in email copy — they change every time the score is re-tuned and have already gone
 * stale three times. Link to the live /scores/accuracy page instead.
 */

/**
 * The current PropertyIQ Score methodology in one sentence (CLAUDE.md §9):
 * four demand-signal inputs from Zillow (home-value momentum) + Realtor (DOM, price cuts).
 * No Redfin. No "% sold above list" / "months of supply" (those were the retired v4 formula).
 */
export const SCORE_DESCRIPTION =
  "The PropertyIQ Score blends four demand signals: home-value momentum over the last 12 and 3 months (from Zillow), how fast homes are selling (median days on market), and the share of listings with price cuts (from Realtor).";

/** Relative path (append to the app base URL) for the live methodology / track-record page. */
export const SCORES_ACCURACY_PATH = "/scores/accuracy";

/** Shared fallback line shown under every CTA button. */
export const BUTTON_FALLBACK_PREFIX =
  "If the button doesn't work, copy this link:";

/** onboarding-day0-welcome.tsx */
export const ONBOARDING_DAY0 = {
  heading: "Your Free PropertyIQ Score Is Ready",
  preview: (name: string) => `Your free PropertyIQ Score is ready, ${name}`,
  greeting: (name: string) => `Hey ${name},`,
  body: "Welcome. Here's how to get your first market score in 60 seconds: open the map, search for any U.S. city or ZIP code, and click it. You'll see a 0–100 PropertyIQ Score that captures supply, demand, affordability, rent growth, and economic momentum — all in one number.",
  cta: "Explore the Map",
} as const;

/** onboarding-day3-compare.tsx */
export const ONBOARDING_DAY3 = {
  heading: "How Investors Use PropertyIQ",
  preview:
    "Here's how investors are using PropertyIQ to find their next market",
  greeting: (name: string) => `Hey ${name},`,
  intro:
    "Here's how a typical PropertyIQ session goes for an investor looking for their next market:",
  step1Label: "Step 1:",
  step1Body:
    " Open the map and filter by PropertyIQ Score > 70. This removes markets with weak fundamentals immediately.",
  step2Label: "Step 2:",
  step2Body:
    " Sort by rent-to-price ratio or score momentum to surface markets gaining ground fast.",
  step3Label: "Step 3:",
  step3Body:
    " Drop 2–3 finalists into the comparison view. Side-by-side metrics, trends, and demographics. Pick the one.",
  closing: "The whole process takes about 10 minutes. Give it a try:",
  cta: "Find Your Next Market",
  upsellHeading: "Want unlimited access?",
  upsellBody:
    "Pro users get 40+ metrics per market, AI-powered reports, and no 5-market cap — everything you need to vet a deal fast.",
  upsellLink: "See Pro plans →",
} as const;

/** onboarding-day5-upgrade.tsx */
export const ONBOARDING_DAY5 = {
  heading: "The 5 Markets That Moved the Most This Month",
  preview: "The 5 markets that moved the most this month",
  greeting: (name: string) => `Hey ${name},`,
  body: "PropertyIQ scores update monthly. Here are the markets that saw the biggest score movement this month — markets gaining ground fast are worth watching before the rest of the market catches on.",
  moversHeading: "Top movers this month",
  moversLeadIn: "Check the platform",
  moversBody:
    " for this month's live rankings — scores update each month and the top movers change.",
  moversLink: "See current rankings →",
  cta: "View Live Market Scores",
} as const;

/** onboarding-day7-profile.tsx */
export const ONBOARDING_DAY7 = {
  heading: "Ready to Go Further?",
  preview: "What Pro users see that free users miss",
  greeting: (name: string) => `Hey ${name},`,
  intro:
    "You've had a week to explore PropertyIQ. Here's what free users can't see yet:",
  benefits: [
    {
      label: "Score breakdowns",
      body: " — understand exactly why a market ranks the way it does",
    },
    {
      label: "40+ data metrics",
      body: " — median DOM, price cuts, rent yield, cap rate, and more",
    },
    {
      label: "AI market reports",
      body: " — plain-English summaries ready to share with partners or agents",
    },
    { label: "Unlimited markets", body: " — no 5-market cap" },
  ],
  cta: "Unlock Pro Access",
  profilePrompt:
    "Or, if you haven't set up your preferences yet, take 60 seconds to tell us your goals and we'll surface markets matched to you:",
  profileLink: "Complete your profile",
} as const;

/** onboarding-day10-zillow.tsx */
export const ONBOARDING_DAY10 = {
  heading: "“I already use Zillow for this.”",
  preview:
    "PropertyIQ does market-level scoring. Zillow does property listings. Different tools.",
  greeting: (name: string) => `Hey ${name},`,
  body1: "We hear this a lot. Zillow is great — for what it does.",
  zillowLabel: "Zillow answers:",
  zillowBody: " What is this property worth?",
  propertyiqLabel: "PropertyIQ answers:",
  propertyiqBody: " Which markets should I be in?",
  body2:
    "Zillow works at the property level — individual listings, Zestimates, days on market for a single home. PropertyIQ works at the market level — scoring every metro, county, and ZIP on supply, demand, affordability, rent growth, and economic momentum. Updated monthly.",
  closing:
    "Use Zillow to pick the property. Use PropertyIQ to pick the market.",
  cta: "See Your Market Scores",
} as const;

/** onboarding-day14-report.tsx */
export const ONBOARDING_DAY14 = {
  heading: "One Thing Before You Go",
  preview: "One thing before you go",
  greeting: (name: string) => `Hey ${name},`,
  intro: "You've had two weeks of PropertyIQ. Here's where things stand:",
  body1:
    "Your free account gives you access to scores across 400+ markets, the interactive map, and Quinn — our AI analyst — forever. No credit card, no expiration.",
  body2:
    "If you've been curious about what's behind the scores — the 40+ data metrics, AI-generated market reports, score breakdowns, and unlimited market comparisons — that's Pro.",
  closing:
    "One number per market is powerful. The full picture is how investors make the call with confidence.",
  cta: "Explore Pro",
  fallbackLeadIn: "Not ready? No problem —",
  fallbackLink: "your free access",
  fallbackTail: " is always here.",
} as const;

/** winback-day14.tsx */
export const WINBACK_DAY14 = {
  heading: "Markets have moved since you last checked in",
  preview: "Markets have moved since you last checked in",
  greeting: (name: string) => `Hey ${name},`,
  body: "A lot can change in two weeks. PropertyIQ scores are updated monthly from Zillow, Census, and Realtor.com data — and some of the markets you were watching may have shifted.",
  whatsNewHeading: "What's new since you left:",
  whatsNew: [
    "📈  Monthly score updates across 400+ metros, 2,000+ counties, and 20,000+ ZIP codes",
    "🗺️  Interactive map with heat-mapped PropertyIQ scores",
    "🤖  Quinn AI can answer market questions in plain English",
  ],
  cta: "See What's Changed",
  browseLeadIn: "Or browse all markets at",
  browseLinkText: "propertyiq.app/markets",
} as const;
