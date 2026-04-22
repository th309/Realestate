import React from "react";
import { Composition, registerRoot } from "remotion";
import { FORMAT_CONFIGS, FormatKey, VideoProps } from "./types";
import { PropertyIQVideo } from "./PropertyIQVideo";

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
        return (
          <Composition
            key={key}
            id={key}
            component={PropertyIQVideo as React.FC<Record<string, unknown>>}
            durationInFrames={cfg.durationInFrames}
            fps={cfg.fps}
            width={cfg.width}
            height={cfg.height}
            defaultProps={defaultProps as unknown as Record<string, unknown>}
          />
        );
      })}
    </>
  );
};

registerRoot(RemotionRoot);
