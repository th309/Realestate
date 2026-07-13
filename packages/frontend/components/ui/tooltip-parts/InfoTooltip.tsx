"use client";

import React from "react";
import { Tooltip } from "./Tooltip";
import type { TooltipPosition } from "./types";

// Info Icon Tooltip (common pattern)
interface InfoTooltipProps {
  content: string;
  position?: TooltipPosition;
  size?: "sm" | "md";
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  position = "top",
  size = "sm",
}) => {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Tooltip content={content} position={position}>
      <button
        type="button"
        className={`
          ${sizeClass} rounded-full
          text-on-surface-variant hover:text-on-surface
          hover:bg-on-surface/10
          transition-colors
        `}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
    </Tooltip>
  );
};
