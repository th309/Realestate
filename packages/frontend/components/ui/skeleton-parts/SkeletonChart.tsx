"use client";

import React from "react";
import { Skeleton } from "./Skeleton";

// Chart skeleton
export const SkeletonChart: React.FC<{
  type?: "line" | "bar" | "pie";
  height?: number;
  className?: string;
}> = ({ type = "line", height = 300, className = "" }) => {
  return (
    <div
      className={`bg-surface-container-low rounded-2xl p-4 ${className}`}
      style={{ height }}
    >
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" height={20} width={150} />
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={32} width={80} />
          <Skeleton variant="rounded" height={32} width={80} />
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1" style={{ height: height - 100 }}>
        {type === "bar" ? (
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around gap-2 h-full">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                className="flex-1 rounded-t"
                height={`${Math.random() * 60 + 40}%`}
              />
            ))}
          </div>
        ) : type === "pie" ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton variant="circular" width={200} height={200} />
          </div>
        ) : (
          <div className="h-full flex items-end">
            <svg
              className="w-full h-full"
              viewBox="0 0 400 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0,150 Q50,100 100,120 T200,80 T300,100 T400,60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-surface-container-highest animate-pulse"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton variant="circular" width={12} height={12} />
            <Skeleton variant="text" height={12} width={60} />
          </div>
        ))}
      </div>
    </div>
  );
};
