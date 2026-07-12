"use client";

import React from "react";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "none";
}

const variantStyles = {
  text: "rounded",
  circular: "rounded-full",
  rectangular: "rounded-none",
  rounded: "rounded-xl",
};

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "text",
  width,
  height,
  animation = "pulse",
}) => {
  // M3 "subtle tonal pulse" motion — respects prefers-reduced-motion via
  // Tailwind's motion-safe:/motion-reduce: variants (no JS media query needed).
  // Reduced-motion users get the same static tonal block, just without the
  // opacity pulse loop.
  const animationClass =
    animation === "pulse" ? "motion-safe:animate-pulse" : "";

  return (
    <div
      className={`
        bg-surface-container-highest
        ${variantStyles[variant]}
        ${animationClass}
        ${className}
      `}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
};
