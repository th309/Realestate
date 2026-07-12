"use client";

import React from "react";
import { Skeleton } from "./Skeleton";
import { SkeletonAvatar } from "./SkeletonAvatar";
import { SkeletonText } from "./SkeletonText";

// Card skeleton
export const SkeletonCard: React.FC<{
  hasImage?: boolean;
  hasHeader?: boolean;
  lines?: number;
  className?: string;
}> = ({ hasImage = false, hasHeader = true, lines = 3, className = "" }) => {
  return (
    <div
      className={`bg-surface-container-low rounded-2xl p-4 elevation-1 ${className}`}
    >
      {hasImage && (
        <Skeleton variant="rounded" height={160} className="w-full mb-4" />
      )}
      {hasHeader && (
        <div className="flex items-center gap-3 mb-4">
          <SkeletonAvatar size="md" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={16} className="w-3/4" />
            <Skeleton variant="text" height={12} className="w-1/2" />
          </div>
        </div>
      )}
      <SkeletonText lines={lines} />
    </div>
  );
};
