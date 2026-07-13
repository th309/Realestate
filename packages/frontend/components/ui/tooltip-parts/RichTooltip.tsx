"use client";

import React, { useState, useRef, useEffect } from "react";
import { useDismissableOpen } from "@/lib/hooks/use-dismissable-open";
import type { TooltipPosition } from "./types";

// Rich Tooltip with title and description
interface RichTooltipProps {
  title?: string;
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  maxWidth?: number;
  className?: string;
}

export const RichTooltip: React.FC<RichTooltipProps> = ({
  title,
  content,
  children,
  position = "top",
  delay = 200,
  maxWidth = 280,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Touch devices have no hover — a tap fires click but not mouseenter, so
  // give the trigger an explicit toggle. Desktop hover/focus above unchanged.
  const toggleTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible((visible) => !visible);
  };

  // Escape + outside click/tap close the tooltip once open — mirrors the
  // Popover pattern below, since touch has no blur/mouseleave to fall back on.
  useDismissableOpen(containerRef, isVisible, () => setIsVisible(false));

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionStyles: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onClick={toggleTooltip}
      aria-expanded={isVisible}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          // Stops the trigger's onClick toggle from also firing when the
          // tap lands on the tooltip body itself — it's a DOM child of the
          // trigger, so without this a tap inside the content self-closes it.
          onClick={(e) => e.stopPropagation()}
          className={`
            absolute z-50 ${positionStyles[position]}
            p-3 bg-surface-container-high rounded-xl elevation-2
            border border-outline-variant
            animate-in fade-in zoom-in-95 duration-150
            ${className}
          `}
          style={{ maxWidth }}
        >
          {title && (
            <div className="text-sm font-medium text-on-surface mb-1">
              {title}
            </div>
          )}
          <div className="text-xs text-on-surface-variant">{content}</div>
        </div>
      )}
    </div>
  );
};
