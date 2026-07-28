import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  FORMAT_CONFIGS,
  FormatKey,
  VideoProps,
  RankingVideoProps,
  SingleMarketVideoProps,
} from "./types";
import { FORMAT_KEYS, compositionId } from "./formats/manifest";
import {
  PropertyIQVideo,
  calculateRankingMetadata,
  calculateLongFormMetadata,
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
          format: key as Exclude<
            FormatKey,
            "top_10_ranking" | "bottom_10_ranking"
          >,
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
