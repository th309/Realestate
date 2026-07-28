import React from "react";
import { AnimatedEntrance } from "../motion";
import {
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  withAlpha,
} from "../styles/tokens";

interface CornerBugProps {
  /** e.g. "TOP 10 PIQ", "BOTTOM 10 CAP RATE" */
  label: string;
  /** e.g. "United States", "California" */
  scope: string;
  /** e.g. "APR 2026" — pulled from params.as_of when present */
  asOf?: string;
}

/**
 * Editorial info-bar plate, top-left. Mirrors the "broadcast bug" pattern
 * used by Bloomberg, CNBC, etc.: a dense, monospace-typed ID block that
 * orients viewers who scrub mid-video. Stays visible the entire run so a
 * thumbnail-stop on any frame still reads as "this is a PropertyIQ ranking
 * of <scope> as of <date>". Also signals premium provenance — most TikTok
 * countdowns omit this and read as anonymous template content.
 *
 * The plate slides in once (gentle spring, no bounce) at the start of its
 * sequence and then holds — persistent furniture shouldn't keep moving.
 */
export const CornerBug: React.FC<CornerBugProps> = ({ label, scope, asOf }) => {
  return (
    <AnimatedEntrance
      from="left"
      distance={40}
      preset="gentle"
      style={{ position: "absolute", top: 48, left: 48, zIndex: 10 }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "14px 22px",
          backgroundColor: withAlpha(PALETTE.stageDeep, 0.55),
          backdropFilter: "blur(8px)",
          borderLeft: brandBorder(PALETTE.indigoMedium),
          fontFamily: FONTS.mono,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: PALETTE.indigoLight,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          PropertyIQ
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: PALETTE.surface,
            lineHeight: 1,
            textTransform: "uppercase",
            ...NUMERIC,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 400,
            letterSpacing: "0.18em",
            color: PALETTE.indigoMuted,
            lineHeight: 1,
            textTransform: "uppercase",
            ...NUMERIC,
          }}
        >
          {scope}
          {asOf ? ` · ${asOf}` : ""}
        </div>
      </div>
    </AnimatedEntrance>
  );
};
