"use client";

import { piq } from "../primitives/piqTokens";

interface MAOTileProps {
  mao: number | null;
  currentPrice: number;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function formatCurrencyFull(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

/**
 * Special hero tile for Fix & Flip strategy. Shows the 70%-rule maximum
 * acceptable offer as the main number, with a pass/fail badge below indicating
 * the spread vs. the current asking price.
 */
export function MAOTile({ mao, currentPrice }: MAOTileProps) {
  const spread = mao != null ? mao - currentPrice : null;
  const isPass = spread != null && spread >= 0;
  const badgeColor =
    spread == null ? piq.textMuted : isPass ? piq.green : piq.red;
  const badgeBg =
    spread == null
      ? piq.canvas
      : isPass
        ? "rgba(0, 200, 83, 0.12)"
        : "rgba(229, 57, 53, 0.12)";
  const badgeLabel =
    spread == null
      ? "Awaiting ARV"
      : isPass
        ? `Pass: ${formatCurrency(Math.abs(spread))} under MAO`
        : `Fail: ${formatCurrency(Math.abs(spread))} over MAO`;

  return (
    <div
      data-mao-tile
      data-status={spread == null ? "pending" : isPass ? "pass" : "fail"}
      className="flex flex-col justify-between"
      style={{
        background: piq.surface,
        border: `0.5px solid ${piq.border}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "13px",
            color: piq.textMuted,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          MAO / 70% Rule
        </div>
        <div
          style={{
            fontSize: "36px",
            fontWeight: 600,
            color: piq.textPrimary,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginTop: 4,
          }}
          title={mao != null ? formatCurrencyFull(mao) : undefined}
        >
          {mao != null ? formatCurrency(mao) : "—"}
        </div>
      </div>
      <div
        className="inline-flex items-center self-start rounded-full"
        style={{
          background: badgeBg,
          color: badgeColor,
          fontSize: "11px",
          fontWeight: 600,
          padding: "4px 10px",
          marginTop: 12,
          letterSpacing: "0.01em",
        }}
      >
        {badgeLabel}
      </div>
    </div>
  );
}
