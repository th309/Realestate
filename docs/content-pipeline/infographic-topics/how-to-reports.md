# Topic: Building AI Market Reports

> **DRAFT — pending Troy's vetting.** Do not generate from this doc until reviewed.

Audience: everyone — buyers, investors, and agents building something to send a
client.
Angle: report creation on PropertyIQ is deliberately short. It is a single page,
not a wizard: pick your market or markets, optionally tell it about your
situation, and generate. The report type is inferred from what you picked rather
than chosen from a menu.

Every control and export path named below is rendered by the live report
creation page today. All numbers must come from the approved-claims rules in
README.md.

## The hook

"Pick a market. Hit generate. Get a written market report that argues a position
and shows its work — then send the link to your client."

## Eight report tasks (one graphic each)

1. **Pick your first market** — search and select. The first market you pick sets
   the geography level for the whole report, and the search then filters to that
   level so you cannot accidentally mix a metro with a ZIP.
2. **Add up to four more to compare** — you can select up to five markets total.
   You never choose a report type: one market produces a single-market report,
   two or more automatically produce a comparison. The product decides from what
   you selected.
3. **Tell it what matters to you** — personalization is optional and collapsed by
   default. The first question is "What matters most to you?", where you pick
   your top three priorities, and the narrative is written against them.
4. **Give it your numbers** — also optional: household income, down payment,
   purchase price, and expected rent. Any field left blank falls back to the
   market median or market rent, so partial answers still work.
5. **Generate** — one button. Nothing else is required beyond at least one
   market.
6. **Read what the report contains** — a generated report opens with the
   market's PropertyIQ Score, then moves through AI-written narrative sections
   and data blocks: metric grids, percentile rank against peers, score
   breakdown, forecast, and strengths and risks. Comparison reports add a
   side-by-side table with per-category winner badges.
7. **Ask the report follow-up questions** — every report carries a conversation
   panel. You can ask things like "What does this score mean for me?", "Is now a
   good time to buy?", or "What are the main risks?" and get an answer grounded
   in that report's data.
8. **Send it out** — export to PDF, or generate a public view-only share link
   that anyone can open without an account.

## Approved claims (use these exact framings)

- Coverage: 900+ metros, 3,000+ counties, 29,000+ ZIPs, scored monthly.
- The PropertyIQ Score leading each report is a 1-99 momentum and timing signal;
  50 = the market's state average; higher scores have historically outperformed
  relative to their state. Momentum words only. A/B/C/F letters are
  data-confidence, never a score grade.
- Data sources: Zillow, Realtor.com, Census, FRED, BLS.
- Narrative sections are AI-written from that market's real data. Say
  "AI-written from live market data", not "AI-generated insights" as a vague
  claim.

## What NOT to claim

- **There is no template picker.** Do not draw one, name one, or imply the user
  chooses a report type. The five named templates that exist in the code
  (Market Snapshot, Market Comparison, Investment Analysis, Affordability &
  Migration, Market Cycle & Risk) are NOT reachable in the live product — they
  belong to an unrendered wizard. Naming them in a graphic would promise a
  feature a user cannot find.
- **There is no reader-type switch.** The homebuyer / investor / agent toggle is
  part of the same unreachable wizard; the live page sends a single universal
  reader type. Do not show the user picking an audience.
- Do not show a pro forma block. Those sections belong to the investment
  template, which is not reachable.
- Reports are market-level. They do not value a specific property; that is the
  Deal Analyzer, and it is a different tool. Do not merge the two in one graphic.
- Do not promise a number of reports per plan, or name a price. Tier packaging
  changes; the topic doc does not track it.

## Needs a decision before use

There is a separate drag-and-drop report builder at /reports/builder with
reorderable sections. It renders and works, but nothing in the main navigation
points at it, so a graphic teaching it would send people somewhere they cannot
otherwise find. Left out of the task list until Troy decides whether to promote
the page or retire it.

## CTA

"Build your first report at propertyiq.app/reports — or see a sample first at
propertyiq.app/reports/sample."
Footer rule: propertyiq.app + "Market-level intelligence. Not property
valuation."

## Visual suggestions (for the generator)

- Task 1: one search field with a selected market chip below it and a small lock
  icon on the geography level, captioned that the first pick sets the level.
- Task 2: five market chips in a row with a caption reading "2 or more becomes a
  comparison, automatically" — the strongest standalone graphic in this set,
  because the inference is the surprising part.
- Task 3: a three-slot priority picker with the real question as the headline.
- Task 4: four labeled input fields, each with a ghosted "leave blank for the
  market median" hint.
- Task 6: a single tall report page mock with its blocks labeled down the side.
- Task 7: a chat bubble overlaying a report page with one of the three real
  starter questions in it.
- Task 8: one report, two arrows out — PDF and share link.
- Style references: sketch-note (hand-drawn) or editorial (cream/slate) per
  Troy's approved sample styles.
