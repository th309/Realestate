/**
 * Discover the latest IRS SOI county-migration release by scraping the SOI
 * landing page → most-recent year subpage → countyinflow/countyoutflow file
 * URLs. Kept separate from the parser so unit tests don't need network.
 */

const IRS_BASE_URL = "https://www.irs.gov";
const IRS_LANDING_URL =
  "https://www.irs.gov/statistics/soi-tax-stats-migration-data";

export interface IrsRelease {
  taxYear: number;
  inflowUrl: string;
  outflowUrl: string;
}

function absolutize(url: string): string {
  return url.startsWith("http") ? url : IRS_BASE_URL + url;
}

/**
 * Scrape the IRS SOI landing page + latest year subpage. Returns null if no
 * release could be located (page structure changed, files missing, etc.).
 */
export async function findLatestIrsRelease(): Promise<IrsRelease | null> {
  const landingHtml = await (await fetch(IRS_LANDING_URL)).text();

  // Per-year subpages, e.g. /statistics/soi-tax-stats-migration-data-2022-2023
  const yearPageMatches = [
    ...landingHtml.matchAll(
      /href="([^"]*soi-tax-stats-migration-data-(\d{4})-(\d{4}))"/g,
    ),
  ];
  if (yearPageMatches.length === 0) {
    console.log("IRS: no migration year subpages found on landing page");
    return null;
  }
  // Pick the entry with the highest ending year
  yearPageMatches.sort((a, b) => parseInt(b[3], 10) - parseInt(a[3], 10));
  const latest = yearPageMatches[0];
  const yearPagePath = latest[1];
  const taxYear = parseInt(latest[3], 10);

  const yearPageUrl = absolutize(yearPagePath);
  const yearHtml = await (await fetch(yearPageUrl)).text();

  const fileMatches = [
    ...yearHtml.matchAll(
      /href="([^"]*county(in|out)flow(\d{4})\.(?:xlsx|csv))"/g,
    ),
  ];
  const inflowEntry = fileMatches.find((m) => m[2] === "in");
  const outflowEntry = fileMatches.find((m) => m[2] === "out");
  if (!inflowEntry || !outflowEntry) {
    console.log(
      `IRS: missing inflow or outflow file on year subpage ${yearPageUrl}`,
    );
    return null;
  }
  return {
    taxYear,
    inflowUrl: absolutize(inflowEntry[1]),
    outflowUrl: absolutize(outflowEntry[1]),
  };
}
