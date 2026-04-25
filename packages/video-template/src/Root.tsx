import React from "react";
import { Composition, registerRoot } from "remotion";
import { FORMAT_CONFIGS, FormatKey, VideoProps } from "./types";
import { PropertyIQVideo, calculateRankingMetadata } from "./PropertyIQVideo";

const RANKING_FORMATS = new Set<FormatKey>([
  "top_10_ranking",
  "bottom_10_ranking",
]);

export const RemotionRoot: React.FC = () => {
  const keys = Object.keys(FORMAT_CONFIGS) as FormatKey[];
  return (
    <>
      {keys.map((key) => {
        const cfg = FORMAT_CONFIGS[key];
        const defaultProps: VideoProps = {
          format: key,
          resolvedMarket: {
            canonical_name: "Preview",
            geography: "metro",
            id: "preview",
          },
          dataBundle: {},
          ctaUrl: "",
        };
        const isRanking = RANKING_FORMATS.has(key);
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
          />
        );
      })}
    </>
  );
};

registerRoot(RemotionRoot);
