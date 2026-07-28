import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { MediaCallout } from "../primitives/MediaCallout";
import { MediaSlot } from "../primitives/MediaSlot";
import { MeshBackground } from "../primitives/MeshBackground";
import { ProductDemoHookScene } from "../scenes/ProductDemoHookScene";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { FORMAT_MANIFEST } from "../formats/manifest";
import {
  buildProductDemoBeats,
  calloutsForFormat,
  defaultCalloutAnchor,
} from "../lib/product-demo-timing";
import type { ProductDemoVideoProps } from "../types";

/**
 * The product explainer: hook, then one beat per feature, then the CTA.
 *
 * The first layout driven by operator-supplied media rather than market
 * data. Each feature beat punches into the region of its screenshot being
 * talked about — panning across a whole dashboard is unreadable at thumb
 * size, which is the reason MediaSlot takes a focus region at all.
 *
 * No BrandBumper: this format is vertical-first and the brand belongs at
 * the end, on the card that already carries the CTA.
 */
export const ProductDemoLayout: React.FC<ProductDemoVideoProps> = (props) => {
  const { format: cfg, isVertical } = useLayoutConfig();
  const manifest = FORMAT_MANIFEST[props.format];

  const hookClipFrames =
    props.hook.kind === "avatar_video"
      ? props.hook.slot.durationInFrames
      : undefined;

  const beats = buildProductDemoBeats(
    props.features.length,
    manifest.beats,
    cfg.fps,
    hookClipFrames,
  );

  return (
    <AbsoluteFill>
      <MeshBackground />

      <Sequence from={beats.hook.from} durationInFrames={beats.hook.duration}>
        <ProductDemoHookScene
          hook={props.hook}
          durationInFrames={beats.hook.duration}
        />
      </Sequence>

      {props.features.map((feature, i) => {
        const beat = beats.features[i];
        if (!beat) return null;
        const callouts = calloutsForFormat(feature.callouts, isVertical);
        return (
          <Sequence
            key={feature.key}
            from={beat.from}
            durationInFrames={beat.duration}
          >
            <MediaSlot slot={feature.slot} durationInFrames={beat.duration} />
            {callouts.map((text, ci) => (
              <MediaCallout
                key={`${feature.key}-${ci}`}
                text={text}
                at={
                  feature.calloutAnchors?.[ci] ??
                  defaultCalloutAnchor(ci, isVertical)
                }
                index={ci}
                // Let the punch-in establish before a label lands on top of
                // it; a callout over a still-moving frame reads as clutter.
                delay={12 + ci * 10}
              />
            ))}
          </Sequence>
        );
      })}

      <Sequence from={beats.cta.from} durationInFrames={beats.cta.duration}>
        {/*
          BrandOutroCard, not Outro: Outro ignores its own ctaUrl prop and
          hardcodes the domain, which is wrong for a format whose closing
          line is authored per video.
        */}
        <BrandOutroCard ctaUrl={props.ctaUrl} headline={props.ctaHeadline} />
      </Sequence>
    </AbsoluteFill>
  );
};
