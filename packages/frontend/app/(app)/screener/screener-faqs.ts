import type { Faq } from "@/lib/seo/faq-json-ld";

export const SCREENER_FAQS: Faq[] = [
  {
    question: "What is the PropertyIQ market screener?",
    answer:
      "The market screener lets you filter and rank every scored PropertyIQ market by PropertyIQ Score, price, cap rate, months of supply, and overvaluation, across metro, county, and ZIP geography levels. It turns thousands of markets into a sortable table so you can find the ones that match a specific investing or buying strategy in seconds.",
  },
  {
    question: "What can I filter markets by in the screener?",
    answer:
      "You can set a minimum and maximum range for PropertyIQ Score, median price, cap rate, months of supply, and overvalued percentage, then combine any of those with a state filter to narrow results further. A market size toggle also lets you hide smaller metros, counties, and ZIPs so the table defaults to markets with enough population to matter, while still letting you switch it off to see every market size.",
  },
  {
    question: "What quick-start presets does the screener offer?",
    answer:
      "Five one-click presets are available. Hottest Markets sorts by PropertyIQ Score, Undervalued + High Score surfaces markets scoring 70 or above that are not overvalued, and Cash-Flow filters to markets with an estimated cap rate of 6 percent or higher. Biggest Gainers and Biggest Losers sort markets by how much their PropertyIQ Score has changed over the selected time window.",
  },
  {
    question:
      "What is the difference between the Screener tab and the Movers tab?",
    answer:
      "The Screener tab shows a full sortable, filterable table of every market, while the Movers tab shows two side-by-side leaderboards of the top markets whose PropertyIQ Score rose or fell the most over your selected time window. Both tabs share the same geography level, state filter, and market size setting, and the window can be set to 1 month, 3 months, 6 months, 1 year, 3 years, or 5 years.",
  },
  {
    question: "Is ZIP-level screening and CSV export free?",
    answer:
      "Screening at the metro and county level is available on the free tier, but ZIP-level results require a Pro plan, and switching the geography selector to ZIP without Pro access shows an upgrade prompt instead of results. Exporting the current table to CSV is also a Pro feature, so free-tier users see a locked Export CSV button in the page header.",
  },
  {
    question: "How current is the data in the screener?",
    answer:
      "Every row in the screener comes from the same monthly snapshot, and the exact date is shown as a Data as of stamp next to the page title. When a new PropertyIQ Score run completes each month, the screener table, its Movers leaderboards, and its CSV export all reflect the new snapshot automatically.",
  },
];
