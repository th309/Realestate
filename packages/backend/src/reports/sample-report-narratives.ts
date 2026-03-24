/**
 * AI Narratives for the Static Sample Report (V2 format)
 *
 * Separated from the main report data to keep files under the 300-line limit.
 * These narratives showcase premium-quality analysis for DFW homebuyers.
 */

export const SAMPLE_REPORT_NARRATIVES = {
  _meta: {
    version: 'v2',
    model: 'claude-sonnet-4-5-20250514',
    generated_at: '2026-03-15T10:30:12Z',
  },

  // Hero section reads this directly
  hero_verdict:
    'DFW delivers where it matters most: a stable economic engine, sustained appreciation, and improving buyer leverage — a compelling window for prepared first-time buyers.',

  // ----- V2 Narrative Sections -----

  executive_verdict:
    "**Dallas-Fort Worth earns a HomeReady Score of 76 — GOOD** — placing it in the top 28% of metros nationwide for homebuyer readiness. This isn't a market where you'll find bargain-basement prices, but it's one where your money is backed by substance: a diversified $600B economy, population inflows that consistently outpace housing starts, and appreciation that has compounded at 6.1% annually over the past five years.\n\nThe market's highest marks come from **stability (83)** and **value trajectory (80)**, reflecting DFW's rare combination of economic resilience and sustained growth. The weakest component — **affordability at 64** — is a real constraint but one that's improving: mortgage rates have dropped 37 basis points since January, effectively adding $18,000 to your purchasing power. For a first-time buyer with $105K income and $65K down, DFW is accessible, well-supported by fundamentals, and positioned for continued appreciation.\n\nWith **3.1 months of inventory** and a **sale-to-list ratio of 98.2%**, the market is firm but no longer the frenzied, multi-offer environment of 2021–2022. Sellers are pricing more realistically (26% have reduced asking prices), and the median home sits on market for 35 days — enough time for deliberate decision-making without the fear of losing out overnight.",

  market_deep_dive:
    "### Price & Value Dynamics\n\nThe typical DFW home is valued at **$398,000** (Zillow Home Value Index), up 5.4% year-over-year — healthy appreciation that outpaces the national average (3.8%) without veering into unsustainable territory. Median listing prices sit at $415,000 with actual sale prices closing at $392,000, a 5.5% listing-to-sale discount that gives buyers room to negotiate.\n\nCompared to peer Sun Belt metros, DFW remains materially more affordable: **Austin ($462K)**, **Nashville ($448K)**, and **Phoenix ($421K)** all carry higher price tags with similar or weaker job growth fundamentals. The price-to-income ratio of **4.73x** sits below the national 5.1x, meaning DFW residents spend a smaller share of income on housing than the average American.\n\n### Supply & Demand Balance\n\nInventory has recovered to **3.1 months of supply**, up from a severe low of 1.4 months in early 2022. This normalization is healthy — it provides buyers with actual options while preventing the dramatic price spikes that characterized the pandemic era. New listings are running at 13,200/month, while pending sales hold strong at 8,800, producing an absorption rate that keeps the market slightly tilted toward sellers but not overwhelmingly so.\n\n**Building permits at 4,500/month** signal continued developer confidence, and the construction pipeline will add approximately 28,000 new homes in 2026 — enough to moderate price growth but not enough to flip the market into oversupply, given that DFW absorbs roughly 155,000 net new residents annually.\n\n### Mortgage Rate Tailwind\n\nThe 30-year fixed rate has eased to **6.38%**, down from 6.75% at the start of 2026. The Fed has signaled two additional cuts this year, and futures markets are pricing in rates near 5.9% by Q4 2026. Each 25-basis-point decline adds approximately **$7,500** in purchasing power on a $398K home — a meaningful tailwind for buyers entering in the next 3–6 months.\n\n### Economic Engine\n\nDFW's economy is its moat. With a GDP approaching $600B and employment spread across technology (TI, AT&T, Salesforce), healthcare (UT Southwestern, Baylor Scott & White), financial services (Goldman Sachs regional HQ, Charles Schwab), and logistics (DFW Airport, BNSF), no single sector accounts for more than 16% of total employment. Job growth of **2.6% annually** is nearly double the national rate, and the unemployment rate of **3.4%** is 50 basis points below the U.S. average. This diversification is why DFW weathered the 2020 downturn with only a 3.2% peak-to-trough home value decline, compared to 7-12% in less diversified markets.",

  your_situation:
    "### Your Financial Position\n\nWith **$105,000 in household income** and a **$65,000 down payment** (16.3% on the median home), you're in a solid starting position. At current rates (6.38%), your estimated monthly principal and interest on a $333,000 loan would be approximately **$2,080**. Adding property taxes (~1.8% of value in Texas, or $597/month), homeowner's insurance (~$200/month), and PMI (~$85/month since you're below 20% down), your total monthly housing cost lands around **$2,960** — roughly **33.8% of gross monthly income**.\n\nThat's right at the conventional 28-33% threshold, which means you qualify comfortably but don't have wide margins. Here's the good news: if rates decline to 5.9% by late 2026 as markets expect, that same payment drops to approximately **$2,800**, or 32% of income — a much more comfortable position.\n\n### Where Your Priorities Align\n\n**Affordability (Your #1 priority):** DFW scores 64 here — not the cheapest market, but dramatically better than comparable metros. Your $65K down payment puts you in a strong position for the **$350K–$400K** range, which captures the sweet spot of established neighborhoods with good schools in areas like Frisco, McKinney, Denton, and Grand Prairie. The key insight: *affordability in DFW is improving in real-time* as rates decline and inventory builds.\n\n**Growth (Your #2 priority):** This is where DFW truly shines. The 80-point value trajectory score reflects 5.4% YoY appreciation backed by corporate relocations, infrastructure investment (TI's $30B Sherman campus, the high-speed rail corridor), and demographic momentum. Historically, buyers who entered DFW at similar score levels saw **18-24% equity gains over five years**.\n\n**Stability (Your #3 priority):** At 83, this is the market's standout. DFW's economic diversification, low foreclosure rate (0.2%), and consistent population growth create a floor under home values that many markets lack. Even in 2020's worst quarter, DFW values barely flinched.\n\n### Timeline Assessment\n\nYour 6-month buying window is **well-aligned with market conditions**. Spring inventory is building, mortgage rates are trending favorably, and the seasonal pattern in DFW shows peak listing volume in April–June with a corresponding softening of buyer competition in late summer. A pre-approval secured now positions you to move decisively when the right property appears.",

  verdict_and_actions: {
    verdict:
      'Dallas-Fort Worth is a **GOOD** market for your homebuying goals — scoring 76 out of 100 with high confidence (A-grade data quality). The combination of economic stability, sustained appreciation, and improving buyer conditions makes this one of the stronger entry points in the current cycle. Your six-month timeline is realistic, and your financial position is solid for the $350K–$400K range. The primary risk is affordability pressure if rates stall, but the trajectory favors buyers through 2026.',
    actions: [
      {
        action: 'Get pre-approved at your target price range ($350K–$400K)',
        rationale:
          'With rates at 6.38% and declining, locking a pre-approval now protects your rate while giving sellers confidence in your offer. Many DFW sellers prioritize pre-approved buyers over those with only pre-qualification.',
        timeframe: 'This week',
      },
      {
        action: 'Focus your search on North and East DFW suburbs',
        rationale:
          'Areas like McKinney, Frisco, Denton, and Forney offer the best value-to-growth ratio in your budget. These corridors benefit from infrastructure investment and corporate relocations while maintaining price points below the metro median.',
        timeframe: 'Next 2 weeks',
      },
      {
        action:
          'Target listings with 14+ days on market for negotiation leverage',
        rationale:
          'With 26% of listings seeing price reductions and a 98.2% sale-to-list ratio, properties that have sat past two weekends are signaling seller flexibility. In your price range, this can translate to $5K–$12K in savings or seller concessions on closing costs.',
        timeframe: 'Ongoing during search',
      },
      {
        action:
          'Monitor the Fed rate decision in June before making a final move',
        rationale:
          'If the Fed cuts as expected, mortgage rates could drop to ~6.1% by mid-summer, adding roughly $12,000 to your purchasing power. However, lower rates also attract more buyers — so be prepared to act quickly if the June cut materializes.',
        timeframe: 'June 2026',
      },
      {
        action:
          'Budget an extra $8K–$12K beyond down payment for closing costs',
        rationale:
          'Texas closing costs average 2.5–3% of the purchase price. On a $380K home, that is $9,500–$11,400. Also budget for a home inspection (~$500) and appraisal gap coverage if competing in a desirable neighborhood.',
        timeframe: 'Before making an offer',
      },
    ],
  },

  what_to_watch: {
    metrics: [
      {
        metric: 'Mortgage Rate (30-year fixed)',
        current: '6.38%',
        threshold: '5.90%',
        direction: 'down' as const,
        rationale:
          'Each 25 bps decline adds ~$7,500 in purchasing power. Below 5.9% historically triggers a buyer surge in DFW — be positioned to move before the crowd.',
      },
      {
        metric: 'Months of Supply',
        current: '3.1 months',
        threshold: '4.0 months',
        direction: 'up' as const,
        rationale:
          "Rising toward 4 months would shift leverage further toward buyers and could slow price growth. Currently healthy at 3.1 — balanced but not yet a buyer's market.",
      },
      {
        metric: 'Sale-to-List Ratio',
        current: '98.2%',
        threshold: '96.0%',
        direction: 'stable' as const,
        rationale:
          'A drop below 96% would signal meaningful buyer leverage and wider negotiation margins. Current 98.2% means most sellers are getting close to asking price.',
      },
      {
        metric: 'DFW Job Growth Rate',
        current: '2.6% YoY',
        threshold: '1.5%',
        direction: 'up' as const,
        rationale:
          'Job growth is the primary demand driver. Below 1.5% would weaken the demand thesis and could slow appreciation. Currently running nearly double the national average.',
      },
      {
        metric: 'Building Permits (monthly)',
        current: '4,500',
        threshold: '5,500',
        direction: 'up' as const,
        rationale:
          'Construction above 5,500/month risks oversupply in suburban corridors. At 4,500, new builds are adding healthy inventory without flooding the market.',
      },
    ],
    scenario:
      "**Base case (60% probability):** Rates ease to 5.9–6.1% by Q4 2026, DFW appreciation moderates to 4–5% annually, and your home purchased at $380K reaches approximately **$440K–$460K by 2031** — representing 16–21% equity gain. This scenario plays out if the Fed follows through on signaled cuts and corporate relocations continue at current pace.\n\n**Bull case (25% probability):** Rates drop below 5.5%, reigniting buyer demand. DFW appreciation accelerates to 6–7% annually as pent-up demand meets still-constrained supply. A $380K purchase could reach **$510K+ by 2031**, but competition for homes intensifies and multiple-offer situations return.\n\n**Bear case (15% probability):** Economic slowdown stalls rate cuts, or trade policy disruption hits Texas manufacturing. Appreciation flattens to 1–2% for 12–18 months before recovering. A $380K purchase would still be worth approximately **$400K–$415K by 2031** — modest but positive, and DFW's diversified economy limits the downside significantly compared to markets dependent on single industries.",
  },
};
