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
  body: "Welcome. Here's how to get your first market score in 60 seconds: open the map, search for any U.S. city or ZIP code, and click it. You'll see a 1–99 PropertyIQ Score that blends four demand signals — home-value momentum, how fast homes sell, and the share of listings with price cuts — into a single number.",
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
    " Open the Screener and set the minimum PropertyIQ Score to 70. That instantly drops every market with weak fundamentals.",
  step2Label: "Step 2:",
  step2Body:
    " Layer on the filters that matter to you — median price, cap rate, or months of supply — to narrow to markets that fit your strategy.",
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
  moversLeadIn: "Open the Screener",
  moversBody:
    " to see this month's current rankings — scores update monthly, so the top markets shift over time.",
  moversLink: "See the current rankings →",
  cta: "See the Rankings",
} as const;

/** onboarding-day7-profile.tsx */
export const ONBOARDING_DAY7 = {
  heading: "You're halfway through your Pro trial",
  preview:
    "What your Pro trial unlocks — and what reverts to free when it ends",
  greeting: (name: string) => `Hey ${name},`,
  intro:
    "You're a week into your PropertyIQ Pro trial. Here's everything you have full access to right now — and what reverts to the free plan once the trial ends:",
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
  trialNote:
    "When your trial ends, your account stays active on the free plan, but these features lock. Upgrade any time to keep them — your saved markets and history stay exactly where they are.",
  cta: "Keep Pro Access",
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
    "Zillow works at the property level — individual listings, Zestimates, days on market for a single home. PropertyIQ works at the market level — scoring every metro, county, and ZIP on demand signals like home-value momentum, days on market, and price cuts. Updated monthly.",
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
    "Your free account gives you access to scores across thousands of markets and the interactive map — forever. No credit card, no expiration.",
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
  body: "A lot can change in two weeks. PropertyIQ scores are updated monthly from Zillow and Realtor data — and some of the markets you were watching may have shifted.",
  whatsNewHeading: "What's new since you left:",
  whatsNew: [
    "📈  Monthly score updates across thousands of metros, counties, and ZIP codes",
    "🗺️  Interactive map with heat-mapped PropertyIQ scores",
    "🤖  AI-generated market reports in plain English",
  ],
  cta: "See What's Changed",
  browseLeadIn: "Or browse all markets at",
  browseLinkText: "propertyiq.app/markets",
} as const;

/**
 * Copy for the hand-rolled HTML email builders in
 * packages/backend/src/email/behavioral-trigger-emails.ts.
 * Lines below are MOVED VERBATIM from those builders — rendered HTML must not change.
 */

/** buildWelcomeEmail */
export const WELCOME_EMAIL = {
  heading: (name: string) => `Welcome to PropertyIQ, ${name}.`,
  intro:
    "You now have access to real-time market intelligence for thousands of ZIP codes, counties, and metros across the US.",
  bulletsHeading: "Here's what to do first:",
  bullets: [
    "Search any market and check its PropertyIQ Score",
    "Compare metros side-by-side",
    "Generate your first market report",
  ],
  cta: "Get Started",
} as const;

/** buildReportGeneratedEmail */
export const REPORT_GENERATED_EMAIL = {
  heading: (name: string) => `Your report is ready, ${name}.`,
  intro: "Here's how to get the most out of your PropertyIQ market report:",
  bullets: [
    "<strong>PropertyIQ Score</strong> — demand signal relative to the state average (50 = average)",
    "<strong>Trend charts</strong> — scroll down to see how key metrics have moved over 3–5 years",
    "<strong>AI narrative</strong> — plain-language summary of what the data means for buyers and investors",
    "<strong>Share link</strong> — send a read-only version to clients or partners",
  ],
  closing: "You can access all your reports from the Reports tab any time.",
  cta: "View My Reports",
} as const;

/** buildPaywallHitEmail */
export const PAYWALL_HIT_EMAIL = {
  heading: (name: string) => `You found something good, ${name}.`,
  intro: (featureName: string) =>
    `You tried to access <strong>${featureName}</strong> — that's a Pro feature. Upgrade now to unlock it along with:`,
  bullets: [
    "Full market deep-dive reports",
    "ZIP-level PropertyIQ Scores",
    "Historical trend data (5 years)",
    "Unlimited market comparisons",
  ],
  closing: "Start a free 14-day trial — no credit card required.",
  cta: "Unlock Pro Features",
} as const;

/** buildPostTrial7dEmail */
export const POST_TRIAL_7D_EMAIL = {
  heading: (name: string) =>
    `Your free report credit is still waiting, ${name}.`,
  intro:
    "It's been a week since your Pro trial ended. You still have a free report credit on your account — use it to generate a full market deep-dive at no cost.",
  body: "Pick any market — city, county, or ZIP — and get a complete analysis with PropertyIQ Scores, trend charts, and an AI narrative.",
  cta: "Use My Free Report",
  upgradePrompt: "Ready to go Pro?",
  upgradeLinkText: "See plans",
} as const;

/** buildInactive24hEmail */
export const INACTIVE_24H_EMAIL = {
  heading: (name: string) => `Hi ${name},`,
  intro:
    "You signed up for PropertyIQ yesterday — great call. Your market intelligence dashboard is ready with real-time scores for thousands of ZIP codes, counties, and metros.",
  body: "Takes less than 2 minutes to explore your first market. Pick any city, county, or ZIP and see how it ranks.",
  cta: "Open My Dashboard",
} as const;

/** buildTrialDay10Email */
export const TRIAL_DAY10_EMAIL = {
  heading: (name: string) => `Hi ${name},`,
  intro:
    "Your PropertyIQ Pro trial ends in <strong>4 days</strong>. After that, you'll lose access to:",
  bullets: [
    "Full market deep-dive reports",
    "ZIP-level PropertyIQ Scores",
    "Historical trend data (5 years)",
    "Unlimited market comparisons",
  ],
  closing: "Lock in your access now and keep the edge you've been building.",
  cta: "Upgrade to Pro",
} as const;

/** buildTrialDay13Email */
export const TRIAL_DAY13_EMAIL = {
  heading: (name: string) => `Hi ${name},`,
  intro:
    "Your Pro trial expires <strong>tomorrow</strong>. Don't lose access right when markets are moving.",
  body: "Upgrading takes 30 seconds. Your analysis, your saved markets, your history — all stays right where you left it.",
  cta: "Keep My Pro Access",
  footnote: "Questions? Reply to this email — we're real people.",
} as const;

/** buildTrialExpiredEmail */
export const TRIAL_EXPIRED_EMAIL = {
  heading: (name: string) => `Hi ${name},`,
  intro:
    "Your PropertyIQ Pro trial has ended. Your account is still active on the free plan, but you've lost access to deep-dive reports and ZIP-level scores.",
  body: "Upgrade any time to get everything back instantly — no re-setup required.",
  cta: "Reactivate Pro",
} as const;

/**
 * buildTrialWillEndEmail — transactional notice sent ~3 days before a paid
 * subscription's first charge. The dollar amount and charge date are per-user
 * and passed into the builder (NOT hardcoded here, per the rule above).
 */
export const TRIAL_WILL_END_EMAIL = {
  heading: (name: string) => `Hi ${name},`,
  intro:
    "Heads up — your PropertyIQ Pro trial is ending soon. Your subscription will continue automatically so you keep every Pro feature without a gap.",
  body: "Nothing to do if you'd like to stay. If Pro isn't for you, cancel anytime before then from your account and you won't be charged.",
  cta: "Manage subscription",
  footnote: "Questions about billing? Just reply — we're real people.",
} as const;

/** buildActiveExplorerEmail (score sentence uses SCORE_DESCRIPTION, kept in builder) */
export const ACTIVE_EXPLORER_EMAIL = {
  heading: (name: string) => `You're asking the right questions, ${name}.`,
  intro:
    "You've already checked several PropertyIQ Scores — here's how experienced investors use them to time their moves.",
  bulletsHeading: "The investor playbook:",
  bullets: [
    "<strong>Score 70+:</strong> Strong demand signal — competition is high, act fast",
    "<strong>Score 50–69:</strong> Balanced market — good for negotiation leverage",
    "<strong>Score &lt;50:</strong> Buyer's market — price concessions are common",
  ],
  cta: "Keep Exploring Markets",
} as const;
