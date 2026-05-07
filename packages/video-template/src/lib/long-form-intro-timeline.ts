import {
  LONG_FORM_MAP_INTRO_SECONDS,
  LONG_FORM_METRO_HERO_SECONDS,
} from "../constants";
import type { SingleMarketVideoProps } from "../types";
import { isMetroPopulationTop200 } from "./metro-hero-eligibility";
import { resolveMetroHeroDisplayUrl } from "./resolve-metro-hero-image-url";

export type LongFormIntroTimeline = {
  mapFrames: number;
  heroFrames: number;
  padFrames: number;
};

export function resolveMetroHeroImageUrlForMarket(
  resolvedMarket: SingleMarketVideoProps["resolvedMarket"],
): string | undefined {
  const override =
    resolvedMarket.hero_image_url &&
    typeof resolvedMarket.hero_image_url === "string"
      ? resolvedMarket.hero_image_url.trim()
      : undefined;

  return resolveMetroHeroDisplayUrl({
    geography: resolvedMarket.geography,
    cbsaCode: resolvedMarket.id,
    heroImageUrlOverride: override || undefined,
  });
}

/** Map → optional metro hero → optional pad within a single intro `Sequence`. */
export function computeLongFormIntroTimeline(
  introFrames: number,
  fps: number,
  resolvedMarket: SingleMarketVideoProps["resolvedMarket"],
): LongFormIntroTimeline {
  const mapTarget = Math.round(fps * LONG_FORM_MAP_INTRO_SECONDS);
  const heroCap = Math.round(fps * LONG_FORM_METRO_HERO_SECONDS);

  const heroUrl = resolveMetroHeroImageUrlForMarket(resolvedMarket);

  const allowHero =
    resolvedMarket.geography === "metro" &&
    isMetroPopulationTop200(resolvedMarket.id) &&
    Boolean(heroUrl);

  if (!allowHero) {
    const mapFrames = Math.min(mapTarget, Math.max(1, introFrames));
    const padFrames = Math.max(0, introFrames - mapFrames);
    return { mapFrames, heroFrames: 0, padFrames };
  }

  /**
   * Full map fly (30s) first — never steal time from it for the hero. Hero
   * stills only use frames **after** `mapTarget`; if intro ≤ 30s there is no
   * hero (caller should budget intro ≥ mapTarget + hero duration when possible).
   */
  const mapFrames = Math.min(mapTarget, Math.max(1, introFrames));
  const heroFrames = Math.min(
    heroCap,
    Math.max(0, introFrames - mapFrames),
  );
  const padFrames = Math.max(0, introFrames - mapFrames - heroFrames);

  return { mapFrames, heroFrames, padFrames };
}
