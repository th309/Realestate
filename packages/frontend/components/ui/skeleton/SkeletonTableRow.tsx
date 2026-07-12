"use client";

import React from "react";
import { Skeleton } from "./Skeleton";

// Table row skeleton
export const SkeletonTableRow: React.FC<{
  columns?: number;
  className?: string;
}> = ({ columns = 5, className = "" }) => {
  return (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          className={`flex-1 ${i === 0 ? "max-w-[200px]" : ""}`}
        />
      ))}
    </div>
  );
};
