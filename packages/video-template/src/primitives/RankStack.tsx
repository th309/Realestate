import React from "react";
import { AnimatedEntrance } from "../motion";
import {
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  withAlpha,
} from "../styles/tokens";

interface StackEntry {
  rank: number;
  marketName: string;
  state: string;
  valueFormatted: string;
}

interface RankStackProps {
  /** All ranks already revealed (oldest → newest). The bottom of the stack is the most recent. */
  history: StackEntry[];
  /** Sliding window size — show only the most recent N entries. */
  windowSize: number;
  /** Accent color for the leading rank pill. Matches HeroRow's accent. */
  accent: string;
}

/**
 * Sliding-window leaderboard column docked to the right edge. As each new
 * row reveals on the hero stage, it slides into the bottom of this stack
 * and the oldest in-window entry slides off the top. The stack persists
 * across the full ranking sequence so viewers always see "what we just
 * counted down past," giving the format the leaderboard-feeling without
 * forcing all 10 on screen at once (which would crowd the hero).
 *
 * By design the current row is NOT in the stack — it lives on the hero
 * stage. The stack only holds previously-revealed ranks. When the hero
 * transitions to the next row, the layout shifts the current row INTO
 * the stack at the bottom.
 *
 * Entries re-assemble on the house 4-frame stagger each time the hero
 * advances, so the column reads as built rather than pasted.
 */
export const RankStack: React.FC<RankStackProps> = ({
  history,
  windowSize,
  accent,
}) => {
  const visible = history.slice(-windowSize);

  return (
    <div
      style={{
        position: "absolute",
        top: 220,
        right: 36,
        bottom: 280,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 14,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {visible.map((entry, idx) => {
        // Older entries (top of stack) fade and shrink slightly.
        const distanceFromBottom = visible.length - 1 - idx;
        const depthOpacity = Math.max(0.35, 1 - distanceFromBottom * 0.18);
        const depthScale = 1 - distanceFromBottom * 0.04;
        const isLeading = idx === visible.length - 1;
        return (
          <AnimatedEntrance
            key={entry.rank}
            index={idx}
            delay={4}
            from="right"
            distance={32}
            preset="gentle"
          >
            {/* Depth fade lives on the card, not the wrapper: AnimatedEntrance
                owns the wrapper's opacity/transform for the entrance itself. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: depthOpacity,
                padding: "10px 14px 10px 10px",
                borderRadius: 12,
                backgroundColor: withAlpha(PALETTE.indigoDark, 0.45),
                backdropFilter: "blur(6px)",
                borderLeft: brandBorder(
                  isLeading ? accent : PALETTE.indigoMedium,
                ),
                transform: `scale(${depthScale})`,
                transformOrigin: "right center",
                maxWidth: 260,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  backgroundColor: isLeading ? accent : PALETTE.indigo,
                  color: isLeading ? PALETTE.stageDeep : PALETTE.surface,
                  fontFamily: FONTS.mono,
                  fontWeight: 800,
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  ...NUMERIC,
                }}
              >
                {entry.rank}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 18,
                    color: PALETTE.surface,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {entry.marketName}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontWeight: 500,
                    fontSize: 13,
                    color: PALETTE.indigoMuted,
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                    ...NUMERIC,
                  }}
                >
                  {entry.state} · {entry.valueFormatted}
                </div>
              </div>
            </div>
          </AnimatedEntrance>
        );
      })}
    </div>
  );
};
