"use client";

import React from "react";
import { Skeleton } from "./Skeleton";

// Score gauge skeleton
export const SkeletonScoreGauge: React.FC<{
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ size = "md", className = "" }) => {
  const sizeMap = { sm: 60, md: 80, lg: 100 };
  const dim = sizeMap[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Skeleton variant="circular" width={dim} height={dim} className="mb-2" />
      <Skeleton variant="text" height={14} width={80} />
    </div>
  );
};
