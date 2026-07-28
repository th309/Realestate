import React from "react";
import { AbsoluteFill } from "remotion";
import { AnimatedEntrance } from "../motion";
import { MediaSlot } from "../primitives/MediaSlot";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { BORDER_WIDTH, FONTS, PALETTE, withAlpha } from "../styles/tokens";
import { COLORS } from "../constants";
import type { ProductDemoHook } from "../media/product-demo-props";

export interface ProductDemoHookSceneProps {
  hook: ProductDemoHook;
  durationInFrames: number;
}

/**
 * The opening beat — the only part of the video most viewers will see.
 *
 * Two deliveries, chosen per video: an avatar clip that carries its own
 * audio, or a typographic card. The card is not a fallback; a bold text
 * hook is the dominant short-form opener and costs nothing per render,
 * where a synthetic presenter costs money per clip and reads as synthetic
 * to an increasing share of viewers.
 *
 * Either way this starts at frame 0 on vertical. Nothing precedes it.
 */
export const ProductDemoHookScene: React.FC<ProductDemoHookSceneProps> = ({
  hook,
  durationInFrames,
}) => {
  if (hook.kind === "avatar_video") {
    return <MediaSlot slot={hook.slot} durationInFrames={durationInFrames} />;
  }
  return <HookCard headline={hook.headline} subhead={hook.subhead} />;
};

const HookCard: React.FC<{ headline: string; subhead?: string }> = ({
  headline,
  subhead,
}) => {
  const { scale, isVertical, safeZone } = useLayoutConfig();

  // Big enough to read while scrolling past. The headline IS the hook.
  const headlineSize = (isVertical ? 108 : 84) * scale;
  const subheadSize = (isVertical ? 40 : 34) * scale;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        paddingTop: safeZone.top,
        paddingBottom: safeZone.bottom,
        paddingLeft: Math.max(safeZone.left, 72 * scale),
        paddingRight: Math.max(safeZone.right, 72 * scale),
      }}
    >
      <AnimatedEntrance index={0} from="left" distance={36}>
        <div
          style={{
            width: 84 * scale,
            height: BORDER_WIDTH * 2,
            background: COLORS.accent,
            marginBottom: 28 * scale,
          }}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={1} from="rise" distance={44}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: headlineSize,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
            color: PALETTE.surface,
            textShadow: `0 4px 24px ${withAlpha(PALETTE.stageDeep, 0.8)}`,
          }}
        >
          {headline}
        </div>
      </AnimatedEntrance>

      {subhead && (
        <AnimatedEntrance index={2} from="rise" distance={28}>
          <div
            style={{
              marginTop: 26 * scale,
              fontFamily: FONTS.body,
              fontWeight: 500,
              fontSize: subheadSize,
              lineHeight: 1.25,
              color: PALETTE.indigoLight,
            }}
          >
            {subhead}
          </div>
        </AnimatedEntrance>
      )}
    </AbsoluteFill>
  );
};
