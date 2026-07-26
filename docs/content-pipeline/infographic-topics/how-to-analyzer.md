# Topic: Analyzing a Deal by Address with the Deal Analyzer

> **DRAFT — pending Troy's vetting.** Do not generate from this doc until reviewed.

Audience: investors and buyers evaluating a specific property.
Angle: the Deal Analyzer at /analyzer is the one place on PropertyIQ that works
on a single PROPERTY rather than a market. You give it an address, it underwrites
the deal, and it grades the result. These infographics teach one underwriting
step at a time.

Critical scope rule: the Deal Analyzer is property-only. It takes an address
(via the `?address=` parameter or the autocomplete box). It never takes a
geography as the subject of the analysis. Market data appears inside it only as
context around the property. Never draw the Analyzer as a way to analyze a metro,
county, or ZIP.

All numbers must come from the approved-claims rules in README.md.

## The hook

"Paste an address. Get cap rate, cash-on-cash, DSCR, and a straight answer on
whether the deal works — before you write the offer."

## Nine analyzer steps (one graphic each)

1. **Start from an address** — type into the address autocomplete, or arrive
   with the address already in the link. One property, one analysis. There is a
   fetch-property-data button that pulls in known details for the address so you
   are not typing everything from scratch.
2. **Pick the strategy you're actually running** — the Analyzer underwrites
   three: Buy & Hold, Fix & Flip, and BRRRR. Each one changes which inputs
   appear and which numbers matter, because a flip and a rental are not the same
   deal.
3. **Let it pick the strategy for you** — the "Help me decide" recommender ranks
   the three strategies against the goal you choose: Cash flow, Long-term
   wealth, Fast cash, or Recycle capital. Same property, four different right
   answers depending on what you want out of it.
4. **Read the rental numbers** — for a hold, the outputs that decide it are net
   operating income, cap rate, cash-on-cash return, monthly cash flow, cash flow
   per door, and DSCR. DSCR below 1.0 means the rent does not cover the debt.
5. **Read the value-add numbers** — for a flip or BRRRR, the deal turns on after
   repair value, total project costs, and maximum allowable offer. The Analyzer
   applies the classic rules directly: max offer is ARV times 0.70 minus rehab
   for flips, and ARV times 0.75 minus rehab for BRRRR.
6. **Find your break-even** — break-even rent and break-even occupancy tell you
   how much room the deal has before it stops working. This is the margin-of-
   safety graphic.
7. **Stress-test the assumptions** — the sensitivity view shows which input
   moves the outcome most, so you know whether the deal dies on interest rate,
   rent, or rehab overrun. Every assumption is editable: appreciation, rent
   growth, expense growth, selling costs, refinance LTV, seasoning and rehab
   months, target DSCR, capex reserve, amortization years, and marginal tax
   rate.
8. **See the market around the property** — the market context section puts the
   property's own market beside it, including its PropertyIQ Score, so a good
   spreadsheet in a cooling market does not look like a good deal by accident.
9. **Save it, share it, take it with you** — analyses save to a saved-analyses
   panel, render to PDF, and have a client-facing share preview so the numbers
   can leave your screen without leaving your notes on them.

## Approved claims (use these exact framings)

- The Deal Analyzer is property-level. Everything else on PropertyIQ is
  market-level. Say so plainly rather than blurring it.
- The PropertyIQ Score shown in market context is a 1-99 momentum and timing
  signal; 50 = the market's state average. Momentum words only. A/B/C/F
  confidence letters are about data quality, never a score grade.
- Coverage, if cited at all: 900+ metros, 3,000+ counties, 29,000+ ZIPs.
- Data sources: Zillow, Realtor.com, Census, FRED, BLS.

## What NOT to claim

- The Analyzer does not appraise the property and does not produce a valuation.
  It models the deal from the price, rent, and rehab figures the user supplies
  or accepts. Keep the "Not property valuation" footer honest.
- The deal grade the Analyzer returns grades THE DEAL. It is not the PropertyIQ
  Score and it is not the A/B/C/F data-confidence letter. Never put a deal grade
  and a score confidence letter in the same graphic without labeling both.
- Do not present the 70% and 75% rules as PropertyIQ inventions. They are
  standard investor rules of thumb the tool applies.

## CTA

"Analyze your next deal at propertyiq.app/analyzer."
Footer rule: propertyiq.app + "Market-level intelligence. Not property
valuation."

## Visual suggestions (for the generator)

- Task 1: a single address bar with a cursor in it and one arrow down to a
  results card — the whole point is that it starts with one input.
- Task 2: three labeled columns, Buy & Hold / Fix & Flip / BRRRR, each with the
  one number that decides it.
- Task 3: four goal chips feeding into a ranked podium of the three strategies.
- Task 4: six result tiles in a grid, each with its metric name and a one-line
  plain-English read.
- Task 5: the max-offer formula written out large as arithmetic — this is the
  most screenshot-friendly graphic in the set.
- Task 7: a tornado chart silhouette with the top three drivers labeled.
- Style references: sketch-note (hand-drawn) or editorial (cream/slate) per
  Troy's approved sample styles.
