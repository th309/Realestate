import type { MarketStatsData } from "@/lib/data";

export function buildStatsJsonLd(
  data: MarketStatsData,
  geoName: string,
  url: string,
): Record<string, unknown> {
  const vars = [
    data.headline.medianPrice,
    data.headline.rent,
    data.headline.daysOnMarket,
    data.headline.yoy,
  ]
    .filter((f) => f.value !== null)
    .map((f) => ({
      "@type": "PropertyValue",
      name: f.label,
      value: f.value,
      ...(f.date ? { observationDate: f.date } : {}),
    }));
  let origin = "https://www.propertyiq.app";
  try {
    origin = new URL(url).origin;
  } catch {
    /* keep default origin */
  }
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${geoName} Housing Market Data`,
    description: `Median price, rent, days on market, year-over-year change, and the PropertyIQ Score inputs for ${geoName}.`,
    url,
    ...(data.latestDate ? { dateModified: data.latestDate } : {}),
    // L4: strengthen Google Dataset Search eligibility for a market-data site.
    // Carries the same @id as the page's standalone Place node so the two
    // describe one identity rather than two disconnected entities.
    spatialCoverage: {
      "@type": "Place",
      "@id": `${url}#place`,
      name: geoName,
      containedInPlace: { "@type": "Country", name: "United States" },
    },
    ...(data.latestDate ? { temporalCoverage: data.latestDate } : {}),
    isAccessibleForFree: true,
    keywords: [
      "real estate",
      "housing market",
      "home prices",
      "PropertyIQ Score",
      geoName,
    ],
    creator: { "@type": "Organization", name: "PropertyIQ" },
    license: `${origin}/terms`,
    variableMeasured: vars,
  };
}
