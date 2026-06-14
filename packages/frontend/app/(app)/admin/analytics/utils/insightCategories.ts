/**
 * Insight Category Definitions & Section Parser
 *
 * Shared between AiInsightsPanel (rendering) and the recommendation parser.
 */

export interface CategoryDef {
  icon: string;
  header: string;
  title: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    icon: "\u{1F534}",
    header: "## \u{1F534} Conversion Blockers",
    title: "Conversion Blockers",
  },
  { icon: "\u26A1", header: "## \u26A1 Quick Wins", title: "Quick Wins" },
  {
    icon: "\u{1F4C8}",
    header: "## \u{1F4C8} Growth Opportunities",
    title: "Growth Opportunities",
  },
  {
    icon: "\u{1F50D}",
    header: "## \u{1F50D} Missing Tracking",
    title: "Missing Tracking",
  },
  {
    icon: "\u{1F4CA}",
    header: "## \u{1F4CA} Retention Signals",
    title: "Retention Signals",
  },
  {
    icon: "\u{1F4B0}",
    header: "## \u{1F4B0} Pricing & Packaging",
    title: "Pricing & Packaging",
  },
  {
    icon: "\u{1F9EA}",
    header: "## \u{1F9EA} Trial Health",
    title: "Trial Health",
  },
  {
    icon: "\u{1F4B8}",
    header: "## \u{1F4B8} Revenue Leaks",
    title: "Revenue Leaks",
  },
  {
    icon: "\u{1F310}",
    header: "## \u{1F310} Acquisition Channels",
    title: "Acquisition Channels",
  },
  {
    icon: "\u{1F3DB}\uFE0F",
    header: "## \u{1F3DB}\uFE0F Brand & Authority",
    title: "Brand & Authority",
  },
  {
    icon: "\u{1F91D}",
    header: "## \u{1F91D} Monetization & Partnerships",
    title: "Monetization & Partnerships",
  },
];

export interface CategorySection {
  title: string;
  icon: string;
  content: string;
}

/**
 * Parse AI markdown into category sections by matching known headers.
 */
export function parseCategorySections(markdown: string): CategorySection[] {
  const sections: CategorySection[] = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const headerIndex = markdown.indexOf(cat.header);
    if (headerIndex === -1) continue;

    const contentStart = headerIndex + cat.header.length;
    let contentEnd = markdown.length;
    for (let j = i + 1; j < CATEGORIES.length; j++) {
      const nextIndex = markdown.indexOf(CATEGORIES[j].header, contentStart);
      if (nextIndex !== -1) {
        contentEnd = nextIndex;
        break;
      }
    }

    const content = markdown.slice(contentStart, contentEnd).trim();
    if (content) {
      sections.push({ title: cat.title, icon: cat.icon, content });
    }
  }

  return sections;
}
