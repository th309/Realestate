export const VALID_SOURCES = [
  "homepage",
  "city-page",
  "exit-intent",
  "newsletter-page",
  "sticky-bar",
  "seo_conversion_bar",
  "seo-investor",
  "seo-homebuyer",
  "seo-agent",
] as const;

export type ValidSource = (typeof VALID_SOURCES)[number];
