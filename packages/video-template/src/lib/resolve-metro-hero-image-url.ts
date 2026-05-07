import curated from "../data/metro-hero-curated-urls.json";

type Curated = Record<string, string>;

/**
 * City hero still URL — **not** Mapbox (interactive map uses Mapbox GL separately).
 *
 * Sources: optional pipeline `hero_image_url`, then CBSA entries in
 * `metro-hero-curated-urls.json` (see `METRO_HERO_IMAGE_GUIDELINES.txt`).
 * Austin 12420: Lou Neff Point skyline (recognizable postcard view) — CC BY 3.0
 * (Mike Credille / Commons); attribute per license in published credits if needed.
 */
export function resolveMetroHeroDisplayUrl(options: {
  geography: string;
  cbsaCode: string;
  heroImageUrlOverride?: string;
}): string | undefined {
  const override = options.heroImageUrlOverride?.trim();
  if (override) return override;

  if (options.geography !== "metro") {
    return undefined;
  }

  const curatedUrl = (curated as Curated)[options.cbsaCode.trim()];
  if (typeof curatedUrl === "string" && curatedUrl.length > 0) {
    return curatedUrl;
  }

  return undefined;
}
