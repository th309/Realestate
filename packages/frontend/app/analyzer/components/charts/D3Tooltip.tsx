"use client";

export interface D3TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  children: React.ReactNode;
}

export function D3Tooltip({ visible, x, y, children }: D3TooltipProps) {
  if (!visible) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: x + 12,
        top: y - 8,
        pointerEvents: "none",
        background: "var(--md-surface-container-high)",
        color: "var(--md-on-surface)",
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "Roboto Mono, monospace",
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}
