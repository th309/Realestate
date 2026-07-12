"use client";

import React from "react";
import { Skeleton } from "./Skeleton";

// Stat card skeleton — mirrors StatCard's three variants exactly (container
// radius/padding, value line height matched to each variant's text size) so
// the loading→loaded swap never shifts layout. `hasIcon` lets a caller that
// knows it won't render an icon skip that placeholder for a tighter match.
export const SkeletonStatCard: React.FC<{
  variant?: "default" | "compact" | "large";
  hasIcon?: boolean;
  className?: string;
}> = ({ variant = "default", hasIcon = true, className = "" }) => {
  if (variant === "compact") {
    return (
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          {hasIcon && (
            <Skeleton
              variant="rounded"
              width={28}
              height={28}
              className="rounded-lg"
            />
          )}
          <div className="space-y-1">
            <Skeleton variant="text" height={12} width={70} />
            <Skeleton variant="text" height={14} width={50} />
          </div>
        </div>
        <Skeleton variant="text" height={16} width={40} />
      </div>
    );
  }

  if (variant === "large") {
    return (
      <div
        className={`bg-surface-container-low rounded-2xl p-6 elevation-1 ${className}`}
      >
        <div className="flex items-start justify-between mb-4">
          <Skeleton variant="text" height={14} width={120} />
          {hasIcon && (
            <Skeleton
              variant="rounded"
              width={36}
              height={36}
              className="rounded-xl"
            />
          )}
        </div>
        <Skeleton variant="text" height={36} width={140} className="mb-2" />
        <div className="flex items-center gap-3">
          <Skeleton variant="rounded" height={20} width={60} />
          <Skeleton variant="text" height={12} width={80} />
        </div>
      </div>
    );
  }

  // default
  return (
    <div
      className={`bg-surface-container-low rounded-xl p-4 elevation-1 ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <Skeleton variant="text" height={14} width={100} />
        {hasIcon && (
          <Skeleton
            variant="rounded"
            width={28}
            height={28}
            className="rounded-lg"
          />
        )}
      </div>
      <Skeleton variant="text" height={28} width={120} className="mb-1" />
      <div className="flex items-center gap-2">
        <Skeleton variant="rounded" height={20} width={60} />
        <Skeleton variant="text" height={12} width={80} />
      </div>
    </div>
  );
};
