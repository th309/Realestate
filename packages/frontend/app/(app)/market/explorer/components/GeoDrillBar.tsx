"use client";
import React from "react";

export interface Crumb {
  label: string;
  active: boolean;
  onClick: () => void;
}
export interface LevelTab {
  label: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}
export interface GeoDrillBarProps {
  crumbs: Crumb[];
  levelTabs: LevelTab[];
}

export function GeoDrillBar({ crumbs, levelTabs }: GeoDrillBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--md-on-surface-variant)",
            marginRight: 4,
          }}
        >
          Scope
        </span>
        {crumbs.map((c, i) => (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {i > 0 && (
              <span style={{ color: "var(--md-outline)", fontSize: 12 }}>
                ›
              </span>
            )}
            <button
              onClick={c.onClick}
              style={{
                border: `1px solid ${c.active ? "var(--md-primary)" : "var(--md-outline-variant)"}`,
                cursor: "pointer",
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                background: c.active ? "var(--md-primary)" : "transparent",
                color: c.active
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          background: "var(--md-surface-container-high)",
          borderRadius: 999,
          padding: 2,
          gap: 2,
        }}
      >
        {levelTabs.map((t) => (
          <button
            key={t.label}
            onClick={t.enabled ? t.onClick : undefined}
            style={{
              border: "none",
              cursor: t.enabled ? "pointer" : "default",
              padding: "5px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              opacity: t.enabled || t.active ? 1 : 0.45,
              background: t.active
                ? "var(--md-surface-container-lowest)"
                : "transparent",
              color: t.active
                ? "var(--md-primary)"
                : "var(--md-on-surface-variant)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
