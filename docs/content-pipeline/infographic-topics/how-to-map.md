# Topic: Using the PropertyIQ Interactive Map

> **DRAFT — pending Troy's vetting.** Do not generate from this doc until reviewed.

Audience: everyone — first-time buyers, investors, and agents.
Angle: the map at /map is the main product experience. It is a color-coded
choropleth where you pick a metric, pick a geography level, and read the country
at a glance. These infographics teach one map skill at a time.

Every control, panel, and label named below exists on the map today under the
name shown. All numbers must come from the approved-claims rules in README.md.

## The hook

"Pick a question. Pick a map level. The whole country colors itself in. That's
the entire learning curve."

## Ten map skills (one graphic each)

1. **Pick your lens: Homebuyer or Investor** — the map has a view-mode switch
   that changes which metric categories you see. Homebuyer shows Affordability,
   Market Competition, and Pricing & Deals. Investor shows Cash Flow,
   Appreciation, and Demand & Risk. Both views then share Area Profile, Local
   Economy, New Construction, and PropertyIQ Scores. Same map, different
   question.
2. **Choose your geography level** — the level pills run National, State, Metro,
   County, City, and Zip. Changing the level re-colors the map at that
   resolution. County and ZIP level are gated behind a paid plan; the pill shows
   a lock and an upgrade prompt rather than failing silently.
3. **Read a category by its question, not its jargon** — every metric category
   is labeled with the plain question it answers: Affordability asks "Can I
   afford to live here?"; Market Competition asks "Should I act fast?"; Pricing
   & Deals asks "Are prices going up or down?"; Cash Flow asks "Will this make
   money monthly?"; Appreciation asks "Will the value grow?"; Demand & Risk asks
   "Can I rent/sell it?"; Area Profile asks "Who lives here?"; Local Economy
   asks "How strong is the job market?"; New Construction asks "What new homes
   are being built?".
4. **Read the color scale** — the legend uses a seven-color ramp and always
   shows the value range for the metric on screen. Grey means no data available
   for that region, which is different from a low value: a region with a value
   of zero gets the bottom color of the ramp, not grey. Ranges are computed from
   the live data on screen, not from fixed thresholds.
5. **Turn on the PropertyIQ Score layer** — the score is its own map layer under
   the PropertyIQ Scores category, so you can color every market by its 1-99
   momentum score. 50 is the market's state average. Momentum words only when
   labeling bands.
6. **Find a market without hunting** — the search box takes a city, ZIP, or
   county and moves the map to it. Faster than panning.
7. **Open a market's detail panel** — clicking a region opens a side panel with
   that market's score gauge, a market snapshot of core metrics (home value,
   days on market, for-sale inventory, home sales), and a trend sparkline. You
   can favorite the market from here to track it.
8. **See where each number came from** — snapshot metrics carry provenance
   badges. An "Inherited" badge means the value came from a parent geography
   (county, metro, state, or national) because the exact region had none, and a
   "Fallback" badge means it came from a backup source. The map tells you when a
   number is borrowed rather than quietly showing it as local.
9. **Right-click a region to go deeper** — the context menu jumps you straight to
   that market elsewhere on the platform: View in Markets, View in Graphs, or
   Generate Report. This is how you get off the map and into the detail without
   losing your place.
10. **Get the data out** — the Table View button opens the current map view as a
    data table, and the table exports to CSV. CSV export is a paid feature; the
    export button shows a padlock and an upgrade prompt without it.

## Approved claims (use these exact framings)

- Coverage: 900+ metros, 3,000+ counties, 29,000+ ZIPs, scored monthly. Never
  write a raw scored count.
- The PropertyIQ Score is a 1-99 momentum and timing signal; 50 = the market's
  state average; higher scores have historically outperformed relative to their
  state. Momentum words only (Very Strong / Strong / Rising / Firming / Steady /
  Easing / Weak / Very Weak). A/B/C/F letters are data-confidence, never a score
  grade.
- Data sources: Zillow, Realtor.com, Census, FRED, BLS.
- Grey on the map means no data, never "bad".

## What NOT to claim

- Do not name a specific number of metrics unless it is checked against the
  registry at generation time. "Metrics across nine categories" is safe;
  "50+ metrics" is not sourced from the approved constants.
- Do not show a metric on a geography level it does not support. Some metrics
  are metro-only, and the map hides unsupported combinations rather than
  drawing an empty layer.
- Do not imply the map values individual properties. It is market-level.
- **The map does not compare markets side by side.** There is no benchmark or
  peer-ranking panel on the map, so do not draw one. Market-versus-market
  comparison lives on /market/compare, and multi-market comparison reports come
  from the report flow. Keep those out of map graphics.

## Needs a decision before use

The map also has a "Your Match" toggle beside the PIQ Score toggle, which
re-colors the choropleth by a personalized Market Match Score derived from the
onboarding preference quiz. It is real and shipping, but it is a second score
surface, so it should not appear in the same graphic as the PropertyIQ Score
without Troy confirming the framing.

## CTA

"Open the map at propertyiq.app/map."
Footer rule: propertyiq.app + "Market-level intelligence. Not property
valuation."

## Visual suggestions (for the generator)

- Task 1: one map outline, split down the middle, homebuyer categories listed on
  the left and investor categories on the right.
- Task 2: a vertical stack of the six level pills with a small map thumbnail
  beside each showing the resolution getting finer.
- Task 3: nine question-cards, each with its icon — this one is a text-forward
  graphic and reads well as a grid.
- Task 4: a single legend strip with the seven swatches, the range labels, and a
  callout on the grey swatch reading "no data, not low".
- Task 7: a device frame showing the click, an arrow, and the detail panel with
  its four snapshot tiles.
- Task 8: one metric tile enlarged with its "Inherited" badge called out, and a
  small ladder showing the ZIP borrowing from its county.
- Task 9: a right-click cursor on a region with the three menu items fanning out
  to three destination thumbnails.
- Style references: sketch-note (hand-drawn) or editorial (cream/slate) per
  Troy's approved sample styles.
