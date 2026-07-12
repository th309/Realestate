"use client";

import React from "react";
import { Skeleton } from "./Skeleton";

export const SkeletonButton: React.FC<{
  size?: "sm" | "md" | "lg";
  width?: number;
  className?: string;
}> = ({ size = "md", width = 100, className = "" }) => {
  const heightMap = { sm: 32, md: 40, lg: 48 };
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={heightMap[size]}
      className={className}
    />
  );
};
