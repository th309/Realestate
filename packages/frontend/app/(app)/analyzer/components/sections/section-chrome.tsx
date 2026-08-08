import {
  Calculator,
  Map,
  Receipt,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import type { PiqTone } from "../primitives/card";

interface SectionChrome {
  tone: PiqTone;
  icon: React.ReactNode;
}

const ICON_PROPS = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;

/**
 * Tone + icon per detail section, keyed by the section id already threaded
 * through `SectionWrapper`.
 *
 * The mockup gives each card a differently tinted icon tile so a long column
 * reads as distinct sections rather than one striped block, and the hues are
 * assigned by meaning, not by cycling: green for projected outcomes, indigo
 * for cash mechanics, amber for risk, violet for comparables, teal for market.
 * Adjacent sections never share a tone — that is the whole point of the
 * device, so check the render order in AnalyzerSections before adding one.
 */
const CHROME: Record<string, SectionChrome> = {
  projection: { tone: "green", icon: <Target {...ICON_PROPS} /> },
  expense_waterfall: { tone: "indigo", icon: <Calculator {...ICON_PROPS} /> },
  sensitivity: { tone: "amber", icon: <TrendingUp {...ICON_PROPS} /> },
  comps: { tone: "violet", icon: <Search {...ICON_PROPS} /> },
  market_context: { tone: "teal", icon: <Map {...ICON_PROPS} /> },
  after_tax: { tone: "indigo", icon: <Receipt {...ICON_PROPS} /> },
};

const FALLBACK: SectionChrome = {
  tone: "indigo",
  icon: <Calculator {...ICON_PROPS} />,
};

export function getSectionChrome(id: string): SectionChrome {
  return CHROME[id] ?? FALLBACK;
}
