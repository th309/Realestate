import React from "react";
import { Composition, registerRoot, staticFile } from "remotion";
import {
  FORMAT_CONFIGS,
  FormatKey,
  VideoProps,
  RankingVideoProps,
  SingleMarketVideoProps,
} from "./types";
import {
  FORMAT_KEYS,
  FORMAT_MANIFEST,
  compositionId,
} from "./formats/manifest";
import { ThumbnailLayout } from "./layouts/ThumbnailLayout";
import { isProductDemoFormat } from "./formats/product-demo-format";
import type { ProductDemoVideoProps } from "./types";
import {
  PropertyIQVideo,
  calculateRankingMetadata,
  calculateLongFormMetadata,
  calculateProductDemoMetadata,
} from "./PropertyIQVideo";
import { loadBrandFonts } from "./styles/fonts";
import {
  MediaSlotProbe,
  MEDIA_SLOT_PROBE_DURATION,
} from "./probes/MediaSlotProbe";

loadBrandFonts();

const RANKING_FORMATS = new Set<FormatKey>([
  "top_10_ranking",
  "bottom_10_ranking",
]);

function buildDefaultProps(key: FormatKey): VideoProps {
  if (isProductDemoFormat(key)) {
    // Studio placeholder only — a real run supplies captured screens. The
    // fixture asset keeps the composition renderable with no network.
    const demo: ProductDemoVideoProps = {
      format: key,
      hook: {
        kind: "text_card",
        headline: "Not using PropertyIQ yet?",
        subhead: "You're guessing where your clients should buy.",
      },
      features: [
        {
          key: "placeholder",
          title: "Your product, on screen",
          callouts: ["Drop a screenshot into this slot"],
          slot: {
            slotId: "feature1",
            kind: "image",
            url: staticFile("test-fixtures/dashboard.png"),
            sourceAspect: 1600 / 900,
            focusRegion: { x: 0.63, y: 0.2, w: 0.22, h: 0.16 },
          },
        },
      ],
      ctaUrl: "https://propertyiq.app",
    };
    return demo;
  }
  if (RANKING_FORMATS.has(key)) {
    const rk = key as "top_10_ranking" | "bottom_10_ranking";
    const ranking: RankingVideoProps = {
      format: rk,
      params: {
        format: rk,
        direction: rk === "top_10_ranking" ? "top" : "bottom",
        metric: {
          id: "propertyiq_score",
          label: "PropertyIQ Score",
          unit: "",
          format: "index",
        },
        scope: { type: "national", id: null, label: "United States" },
        geo_level: "metro",
        as_of: "2026-04-01",
        resolved_markets: [],
      },
      ctaUrl: "",
    };
    return ranking;
  }
  const single: SingleMarketVideoProps =
    key === "long_form_deep_dive"
      ? {
          format: "long_form_deep_dive",
          resolvedMarket: {
            canonical_name: "Austin, TX",
            geography: "metro",
            id: "12420",
            latitude: 30.2672,
            longitude: -97.7431,
          },
          dataBundle: {},
          ctaUrl: "",
        }
      : {
          // Ranking and product-demo keys already returned above; Set.has()
          // and the type predicate don't both narrow, so state what's left.
          format: key as SingleMarketVideoProps["format"],
          resolvedMarket: {
            canonical_name: "Preview",
            geography: "metro",
            id: "preview",
          },
          dataBundle: {},
          ctaUrl: "",
        };
  return single;
}

export const RemotionRoot: React.FC = () => {
  // Registered straight off the manifest, so a new template appears here by
  // declaring itself rather than by editing this file.
  return (
    <>
      {FORMAT_KEYS.map((key) => {
        const cfg = FORMAT_CONFIGS[key];
        const defaultProps = buildDefaultProps(key);
        const isRanking = RANKING_FORMATS.has(key);
        const isLongForm = key === "long_form_deep_dive";
        return (
          <Composition
            key={key}
            id={compositionId(key)}
            component={PropertyIQVideo as React.FC<Record<string, unknown>>}
            durationInFrames={cfg.durationInFrames}
            fps={cfg.fps}
            width={cfg.width}
            height={cfg.height}
            defaultProps={defaultProps as unknown as Record<string, unknown>}
            {...(isRanking && {
              // calculateRankingMetadata is sync; Remotion accepts sync fns too.
              // Double-cast through unknown to bridge VideoProps ↔ Record<string,unknown>.
              calculateMetadata: calculateRankingMetadata as unknown as (arg: {
                props: Record<string, unknown>;
              }) => Promise<{
                durationInFrames: number;
                fps: number;
                width: number;
                height: number;
              }>,
            })}
            {...(isProductDemoFormat(key) && {
              // Length follows the authored feature count — three features
              // and six are different videos.
              calculateMetadata:
                calculateProductDemoMetadata as unknown as (arg: {
                  props: Record<string, unknown>;
                }) => Promise<{
                  durationInFrames: number;
                  fps: number;
                  width: number;
                  height: number;
                }>,
            })}
            {...(isLongForm && {
              calculateMetadata: calculateLongFormMetadata as unknown as (arg: {
                props: Record<string, unknown>;
              }) => Promise<{
                durationInFrames: number;
                fps: number;
                width: number;
                height: number;
              }>,
            })}
          />
        );
      })}

      {/*
        One designed thumbnail composition per format, rendered as a still
        instead of grabbing a frame out of the video. A frame lifted from
        motion is mid-word and accidentally composed; for YouTube the
        thumbnail is about half the click decision.
      */}
      {FORMAT_KEYS.map((key) => {
        const m = FORMAT_MANIFEST[key];
        return (
          <Composition
            key={`${key}-thumb`}
            id={`${compositionId(key)}-thumbnail`}
            component={
              ThumbnailLayout as unknown as React.FC<Record<string, unknown>>
            }
            durationInFrames={1}
            fps={m.fps}
            width={m.width}
            height={m.height}
            defaultProps={
              {
                formatKey: key,
                variant: m.thumbnail.layout,
                headline: m.displayName,
                eyebrow: "PropertyIQ",
              } as unknown as Record<string, unknown>
            }
          />
        );
      })}

      {/*
        Render harness for the media-slot primitives — proves image punch-in
        and real video embedding survive a headless render. Not a
        customer-facing format; see probes/MediaSlotProbe.
      */}
      <Composition
        id="media-slot-probe"
        component={MediaSlotProbe}
        durationInFrames={MEDIA_SLOT_PROBE_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
