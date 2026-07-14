import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const MAP_FAQS: Faq[] = [
  {
    question: "What metrics can I visualize on the PropertyIQ map?",
    answer:
      "The interactive map covers 40+ metrics, including the PropertyIQ Score, home values, rent prices, inventory, and days on market. You can select any of them from a single dropdown, and the map renders your choice as a color-coded heat map across the country.",
  },
  {
    question: "What geography levels can I view on the map?",
    answer: `You can zoom from a national overview down to individual ZIP codes, covering ${COVERAGE_COPY.sentence}. The map automatically adjusts which geography level renders based on your zoom, from state boundaries down to ZIP-code polygons.`,
  },
  {
    question: "How is the map's color scale calculated?",
    answer:
      "Colors are assigned dynamically from the actual data range for the selected metric, not fixed breakpoints. Percentage-based metrics use the 5th to 95th percentile of values, dollar and count metrics use the minimum to 95th percentile, and index metrics like the PropertyIQ Score use the full minimum to maximum range, so the scale always reflects the real spread of current data.",
  },
  {
    question: "How often is the map data updated?",
    answer:
      "PropertyIQ's underlying metrics are refreshed monthly as new data arrives from Zillow, Realtor.com, and other source providers. Each metric card on the map shows its own as-of date, since different data sources publish on slightly different monthly schedules.",
  },
  {
    question:
      "What's the difference between the Homebuyer and Investor map views?",
    answer:
      "The Homebuyer view groups metrics around affordability, market competition, and pricing trends, while the Investor view groups metrics around cash flow, appreciation, and demand and risk. Both views share the same underlying metric data and also include area profile, local economy, and new construction categories.",
  },
  {
    question: "Can I access the map's underlying data programmatically?",
    answer:
      "Yes. The same metric data shown on the map is available through the PropertyIQ MCP server for Claude integrations on Pro plans, and through the PropertyIQ Platform API's metrics endpoints on Enterprise plans (ChatGPT does not support MCP yet). Both provide the same monthly-refreshed values that power the map's heat layers.",
  },
];
