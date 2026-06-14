"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  badge?: { text: string; color: string };
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  children: React.ReactNode;
}

export function DashboardCard({
  title,
  icon: Icon,
  badge,
  loading = false,
  error = null,
  onClick,
  children,
}: DashboardCardProps) {
  const isClickable = typeof onClick === "function";

  return (
    <div
      className={[
        "bg-surface-container-low border border-outline-variant rounded-xl",
        isClickable
          ? "cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-on-surface-variant" />
          <span className="text-sm font-medium text-on-surface">{title}</span>
        </div>
        {badge && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-surface-container-high rounded animate-pulse" />
            <div className="h-4 bg-surface-container-high rounded animate-pulse w-4/5" />
            <div className="h-4 bg-surface-container-high rounded animate-pulse w-3/5" />
          </div>
        ) : error ? (
          <div className="bg-error-container/30 rounded-lg p-3 text-xs text-error">
            {error}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer hint */}
      {isClickable && !loading && !error && (
        <div className="px-4 pb-3">
          <span className="text-xs text-on-surface-variant/60">
            Click for details
          </span>
        </div>
      )}
    </div>
  );
}
