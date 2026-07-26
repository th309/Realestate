# Topic: What Real Estate Investors Can Do with the PropertyIQ MCP

> **DRAFT — pending Troy's vetting.** Do not generate from this doc until reviewed.

Audience: real estate investors — buy-and-hold, small portfolio, and 1031
exchange sellers.
Angle: the PropertyIQ MCP puts underwriting tools inside an AI assistant. The
investor asks a plain English question, the assistant calls PropertyIQ's tools,
and the answer comes back with live market data behind it. No spreadsheet, no
tab-hopping.

Every tool named below is a real, live MCP tool documented on the product's own
MCP page. Do not invent tools or rename these. All numbers must come from the
approved-claims rules in README.md.

## The hook

"Ask your AI assistant whether the deal works. It runs the numbers against live
market data — cap rate, cash-on-cash, cycle position — and tells you."

## Eight investor workflows (all real tools)

1. **Screen a whole state for cashflow** — `top_cashflow_markets`: ranks markets
   in a state by rent-to-price ratio, at metro or ZIP level. Ask: "Best cashflow
   ZIPs in Ohio right now?"
2. **Run the napkin math on a ZIP** — `cashflow_estimate`: a back-of-napkin model
   returning monthly cashflow, cap rate, and cash-on-cash return from a ZIP code,
   a purchase price, and a down payment percentage. Ask: "If I buy at $240K in
   43206 with 20% down, what's the monthly cashflow?"
3. **Pressure-test one specific deal** — `deal_analyzer`: takes a market, a
   purchase price, and an expected monthly rent, and returns gross rent
   multiplier, cap rate, cash-on-cash, and a verdict. This is the one to reach
   for when there is a real property under contract.
4. **Choose your tradeoff: appreciation or cashflow** —
   `appreciation_vs_cashflow_matrix`: places markets on a 2x2 quadrant — Growth,
   Balanced, Cashflow, or Avoid — so the tradeoff is a picture rather than an
   argument. Ask: "Plot Columbus, Tampa, and Boise on the appreciation versus
   cashflow matrix."
5. **Check where the market sits in its cycle** — `market_cycle_position`:
   classifies a market as Recovery, Expansion, Hyper-Supply, or Recession. Timing
   context before you commit capital.
6. **Plan a 1031 exchange** — `exchange_1031_targets`: give it the market you are
   selling out of and it returns ranked replacement markets to redeploy into,
   with the count you ask for.
7. **Find the concentration risk in your portfolio** —
   `portfolio_diversification_score`: assesses geographic concentration across
   the markets you already hold. Pair with `portfolio_market_health` when you
   want the current condition of each holding's market rather than the
   concentration picture.
8. **Judge a short-term rental market before you furnish it** —
   `short_term_rental_viability`: assesses short-term rental viability from
   tourism, income, and rental trend signals, so the Airbnb thesis gets tested
   before the couch gets bought.

## Supporting tools worth naming (all real)

Use these as pairings inside a single-task graphic, never as a second task on
the same canvas: `get_propertyiq_score` (the 1-99 momentum score for any market),
`get_market_snapshot` (current conditions in one call), `compare_market_benchmarks`
(a market against national, state, or division medians), `get_home_value_forecast`,
`vacancy_risk_score`, `rent_pricing_analysis`, and `rent_vs_own_analysis`.

## Why it's credible (approved claims only)

- Coverage: 900+ metros, 3,000+ counties, 29,000+ ZIPs scored monthly.
- The PropertyIQ Score is a 1-99 momentum signal — 50 = state average; higher
  scores have historically outperformed relative to their state (metro level,
  full-formula era, 865 metros: top band 81-99 +0.38pp annualized 3-year excess
  versus state; bottom band 1-20 -1.29pp). Momentum words only; A/B/C/F letters
  are data-confidence, never a score grade.
- Data sources: Zillow, Realtor.com, Census, FRED, BLS.
- Access: connecting the MCP requires a PropertyIQ Pro or Enterprise plan. In
  Claude.ai it is added as a custom connector and signs in with the PropertyIQ
  account — no API key. Claude Code, Claude Desktop, Cursor, Windsurf, and VS
  Code are also supported.

## What NOT to claim

- The MCP tools work at market level. They do not appraise or value an
  individual property. `cashflow_estimate` and `deal_analyzer` take the price
  and rent the investor supplies — they model a deal, they do not price a house.
- Do not present the 2x2 matrix "Avoid" quadrant as investment advice; it is a
  positioning label.

## CTA

"Connect the PropertyIQ MCP to your AI assistant — setup at
propertyiq.app/docs/mcp."
Footer rule: propertyiq.app + "Market-level intelligence. Not property
valuation."

## Visual suggestions (for the generator)

- One panel per workflow, each headed by the plain English question an investor
  would actually type, with the tool name shown small as the mechanism.
- Task 4 is the strongest standalone visual: a literal 2x2 with the four quadrant
  names and a few plotted markets.
- Task 5 works as a cycle wheel with a marker on one of the four phases.
- Task 2 or 3 works as a single "question in, numbers out" card — chat bubble on
  the left, three result tiles (cashflow, cap rate, cash-on-cash) on the right.
- Style references: sketch-note (hand-drawn) or editorial (cream/slate) per
  Troy's approved sample styles.
