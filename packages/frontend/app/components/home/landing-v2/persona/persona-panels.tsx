import { TrendingUp, Building2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The two audiences the homepage persona band switches between.
 *
 * The Investor panel is the approved mockup's copy verbatim. The Agent panel
 * is not in the mockup — that artifact only drew the Investor state — so it is
 * written from what the product actually ships: the consultation-brief,
 * listing-presentation, farm-area and market-update tools, plus the MCP
 * integration. Nothing here claims a capability that does not exist.
 */

export type PersonaPanel = {
  key: string;
  /** Label on the toggle. */
  tab: string;
  Icon: typeof TrendingUp;
  title: string;
  tagline: string;
  body: ReactNode;
  checks: string[];
};

export const PERSONA_PANELS: PersonaPanel[] = [
  {
    key: "investors",
    tab: "For Investors",
    Icon: TrendingUp,
    title: "For Investors",
    tagline: "Buy the trend, not the story.",
    body: (
      <>
        By the time a market lands on a &ldquo;best places to invest&rdquo;
        list, the momentum is already priced in. PropertyIQ ranks every market
        cross-sectionally each month and calibrates the result against its own
        state, so you can see which markets are turning while they&rsquo;re
        still cheap.
      </>
    ),
    checks: [
      "One 1–99 score per metro, county, and ZIP — updated monthly",
      "Calibrated so 50 equals that market's own state average",
      "Backtested to 2001; markets scoring 45–55 realized ≈0 excess return",
      "Confidence grade on every score, so you know what the data supports",
      "Drill metro → county → ZIP without changing tools",
    ],
  },
  {
    key: "agents",
    tab: "For Agents & Syndicators",
    Icon: Building2,
    title: "For Agents & Syndicators",
    tagline: "Bring evidence to the appointment.",
    body: (
      <>
        Clients don&rsquo;t want your read on the market, they want something
        they can check. PropertyIQ turns the same scored dataset behind the
        product into the collateral you present — consultation briefs, listing
        data, and branded reports, each carrying the score and the confidence
        behind it.
      </>
    ),
    checks: [
      "Buyer consultation briefs and listing presentation data, per market",
      "Branded reports you can hand a client, exported in minutes",
      "Farm area analysis down to the ZIP, so you prospect where demand is turning",
      "Monthly market update emails written from the same scored dataset",
      "Query any market straight from Claude over MCP — no dashboard required",
    ],
  },
];
