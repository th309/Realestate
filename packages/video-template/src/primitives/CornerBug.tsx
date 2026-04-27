import React from "react";

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
 */
export const CornerBug: React.FC<CornerBugProps> = ({ label, scope, asOf }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: 48,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 22px",
        backgroundColor: "rgba(8, 8, 26, 0.55)",
        backdropFilter: "blur(8px)",
        borderLeft: "2px solid #5C6BC0",
        fontFamily: "'Roboto Mono', monospace",
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: "#C5CAE9",
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
          color: "#FFFFFF",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "0.18em",
          color: "#9FA8DA",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {scope}
        {asOf ? ` · ${asOf}` : ""}
      </div>
    </div>
  );
};
