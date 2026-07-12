"use client";

import React, { useState, useRef } from "react";
import { useDismissableOpen } from "@/lib/hooks/use-dismissable-open";
import type { TooltipPosition } from "./types";

// Popover (click-triggered, more complex content)
interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  position?: TooltipPosition;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  position = "bottom",
  className = "",
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissableOpen(containerRef, isOpen, () => {
    setIsOpen(false);
    onOpenChange?.(false);
  });

  const toggleOpen = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const positionStyles: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-0 mt-2",
    left: "right-full top-0 mr-2",
    right: "left-full top-0 ml-2",
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div onClick={toggleOpen} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 ${positionStyles[position]}
            bg-surface-container-high rounded-xl elevation-3
            border border-outline-variant
            animate-in fade-in zoom-in-95 duration-200
            ${className}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
};
