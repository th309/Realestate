import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  FORMAT_CONFIGS,
  FormatKey,
  VideoProps,
  RankingVideoProps,
  SingleMarketVideoProps,
} from "./types";
import {
  PropertyIQVideo,
  calculateRankingMetadata,
  calculateLongFormMetadata,
} from "./PropertyIQVideo";

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
  const single: SingleMarketVideoProps = {
    format: key as Exclude<FormatKey, "top_10_ranking" | "bottom_10_ranking">,
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
  const keys = Object.keys(FORMAT_CONFIGS) as FormatKey[];
  return (
    <>
      {keys.map((key) => {
        const cfg = FORMAT_CONFIGS[key];
        const defaultProps = buildDefaultProps(key);
        const isRanking = RANKING_FORMATS.has(key);
        const isLongForm = key === "long_form_deep_dive";
        return (
          <Composition
            key={key}
            id={key.replace(/_/g, "-")}
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
    </>
  );
};

registerRoot(RemotionRoot);
