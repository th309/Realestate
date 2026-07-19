// Query-classification logic for the monthly Search Console trend report
// (see search-console-trends.js). Kept separate so the regex/fetch logic can
// be reasoned about (and unit-tested) independent of the reporting/IO layer.
//
// The bot-pattern exclusion exists because a "county X market signals" query
// cluster ranks well in Search Console but has 0% CTR across dozens of
// impressions per query — a scraper/AI-agent signature, not real search demand.

const { querySearchAnalytics } = require("./search-console");

const TOP_N = 20;
const ROW_LIMIT = 25000;
const MAX_PAGES = 4; // 100k distinct queries is far beyond current site volume; a sane ceiling.
const WINDOW_DAYS = 90; // Rolling window, not calendar-month: at current volume most
// professional/investor queries have single-digit impressions, so a strict
// calendar month is too noisy to compare run over run. A 90-day rolling window,
// refreshed monthly, smooths that while still tracking real movement.
const GSC_LAG_DAYS = 3; // Search Console's own data-processing lag.

const BOT_PATTERN = /market signals/i;
const BRAND_PATTERN = /\b(property ?iq|propertyiq)\b/i;
const GEO_LOOKUP_PATTERN =
  /^(what (county|area|neighborhood) is|where is|what is .*zip code|zip code for|what cheer)\b/i;
const PROFESSIONAL_INVESTOR_PATTERN =
  /\b(invest(ing|ment|or)?s?|cash ?flow|cap ?rate|cash.on.cash|rental (property|properties|income|yield)|rent.to.(price|income)|\broi\b|return on investment|turnkey|1031|flip(ping|s)?|airbnb|short.?term rental|\bstr\b|buy and hold|brrrr|hard money|portfolio|appreciation|undervalued|overvalued|good (time|market|investment) to (buy|invest)|best (markets?|cities|places) (to invest|for investors|to buy)|top (markets?|cities) (for|to)|rent vs\.?\s?(buy|own|renting|buying)|months? of supply|days on market|price reduc|\bnoi\b|equity|leverage|refinance|buyers? market|sellers? market|market (forecast|health|cycle|trend)|home value forecast|migration (trend|pattern)|population growth|comps?\b|\bcma\b|\bmls\b|farm area|commission split|listing presentation|cap ex|absorption rate|housing forecast|home price forecast|real estate forecast)\b/i;

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function computeWindow(asOfFlag) {
  const asOf = asOfFlag ? new Date(`${asOfFlag}T00:00:00Z`) : new Date();
  const end = new Date(asOf.getTime() - GSC_LAG_DAYS * 86400000);
  const start = new Date(end.getTime() - WINDOW_DAYS * 86400000);
  return {
    asOfIso: toISODate(asOf),
    start: toISODate(start),
    end: toISODate(end),
  };
}

async function fetchAllQueries(token, start, end) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await querySearchAnalytics(token, {
      start,
      end,
      dimensions: "query",
      rowLimit: String(ROW_LIMIT),
      startRow: String(page * ROW_LIMIT),
    });
    const pageRows = body.rows || [];
    rows.push(...pageRows);
    if (pageRows.length < ROW_LIMIT) break;
  }
  return rows;
}

function classify(rows) {
  const excludedBot = [];
  const excludedBrand = [];
  const excludedGeo = [];
  const proQueries = [];

  for (const row of rows) {
    const q = row.keys[0];
    if (BOT_PATTERN.test(q)) {
      excludedBot.push(row);
    } else if (BRAND_PATTERN.test(q)) {
      excludedBrand.push(row);
    } else if (GEO_LOOKUP_PATTERN.test(q)) {
      excludedGeo.push(row);
    } else if (PROFESSIONAL_INVESTOR_PATTERN.test(q)) {
      proQueries.push(row);
    }
  }

  proQueries.sort((a, b) => b.impressions - a.impressions);
  return { proQueries, excludedBot, excludedBrand, excludedGeo };
}

module.exports = {
  TOP_N,
  WINDOW_DAYS,
  GSC_LAG_DAYS,
  computeWindow,
  fetchAllQueries,
  classify,
};
