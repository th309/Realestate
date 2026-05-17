"use client";

import { piq } from "./piqTokens";

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Three muted pulsing lines — shown when Pro tier but no verdict yet. */
export function VerdictSkeleton() {
  return (
    <div
      className="space-y-2"
      aria-label="Loading AI verdict"
      role="status"
      aria-busy="true"
    >
      <div
        className="animate-pulse rounded h-3"
        style={{ background: piq.border, width: "100%" }}
      />
      <div
        className="animate-pulse rounded h-3"
        style={{ background: piq.border, width: "92%" }}
      />
      <div
        className="animate-pulse rounded h-3"
        style={{ background: piq.border, width: "58%" }}
      />
    </div>
  );
}

/** Free-tier paywall: lock icon, description, indigo "Upgrade to Pro" button. */
export function VerdictLocked({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2"
        style={{
          fontSize: "14px",
          color: piq.textPrimary,
          fontWeight: 600,
        }}
      >
        <span style={{ color: piq.textMuted }}>
          <LockIcon />
        </span>
        <span>AI verdict locked</span>
      </div>
      <p
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: piq.textMuted,
          margin: 0,
        }}
      >
        Pro members get a streaming, deal-specific verdict from our AI coach.
        Free preview: this looks like a marginal deal based on the cap rate
        alone.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center rounded-full transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          background: piq.indigo,
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 600,
          padding: "8px 16px",
          letterSpacing: "0.01em",
        }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}

/**
 * Pro tier streaming/settled verdict body. Text grows naturally with content.
 * The previous 4-line clamp + always-on bottom fade was hiding the end of
 * normal-length verdicts mid-sentence; with AI verdicts typically being a
 * short paragraph, letting the container grow is the cleaner read.
 */
export function VerdictBody({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  return (
    <div aria-live="polite" aria-atomic="false">
      <div
        style={{
          fontSize: "15px",
          lineHeight: 1.6,
          color: piq.textPrimary,
        }}
      >
        {text}
        {isStreaming && (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              marginLeft: "2px",
              color: piq.indigo,
              fontWeight: 700,
              animation: "piq-cursor-pulse 1s ease-in-out infinite",
            }}
          >
            ▊
          </span>
        )}
      </div>
    </div>
  );
}
