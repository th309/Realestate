import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SPRINGS, SpringPreset, staggerDelay } from "./presets";

type EntranceDirection = "rise" | "fall" | "left" | "right" | "scale" | "none";

export interface AnimatedEntranceProps {
  children: React.ReactNode;
  /**
   * Position within a staggered sibling group — element index * 4 frames
   * of delay. ALWAYS pass this when mapping over a list; simultaneous
   * sibling entrances are banned.
   */
  index?: number;
  /** Extra delay in frames before the (staggered) entrance begins. */
  delay?: number;
  /** Where the element enters from. Default "rise" (24px up + settle). */
  from?: EntranceDirection;
  /** Travel distance in px for directional entrances. */
  distance?: number;
  /** Spring preset. Default "entrance" (slight overshoot + settle). */
  preset?: SpringPreset;
  /** Merged onto the wrapper div (layout styles live here). */
  style?: React.CSSProperties;
}

/**
 * The house entrance: spring-in with a slight overshoot/settle, staggered
 * by sibling index. Every composition mounts list items, cards, and scene
 * elements through this instead of hand-rolling interpolate() fades.
 *
 * Motion recipe: opacity leads (fully visible ~2/3 through the spring),
 * scale settles 1.05 → 1.0, directional travel decays with the spring so
 * the overshoot reads as a natural brake, not a hard stop.
 */
export const AnimatedEntrance: React.FC<AnimatedEntranceProps> = ({
  children,
  index = 0,
  delay = 0,
  from = "rise",
  distance = 24,
  preset = "entrance",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = delay + staggerDelay(index);

  const progress = spring({
    frame: frame - start,
    fps,
    config: SPRINGS[preset],
  });

  // Opacity leads the travel so the settle overshoot is visible, not faded.
  const opacity = Math.min(1, Math.max(0, progress * 1.5));

  const remaining = 1 - progress; // >0 before settle, <0 during overshoot
  let transform: string;
  switch (from) {
    case "rise":
      transform = `translateY(${remaining * distance}px) scale(${1 + remaining * 0.05})`;
      break;
    case "fall":
      transform = `translateY(${-remaining * distance}px) scale(${1 + remaining * 0.05})`;
      break;
    case "left":
      transform = `translateX(${-remaining * distance}px)`;
      break;
    case "right":
      transform = `translateX(${remaining * distance}px)`;
      break;
    case "scale":
      transform = `scale(${1 + remaining * 0.08})`;
      break;
    case "none":
      transform = "none";
      break;
  }

  return <div style={{ ...style, opacity, transform }}>{children}</div>;
};
