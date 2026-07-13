"use client";

import React, { useState, useRef, useEffect } from "react";
import type { TooltipPosition } from "./types";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 200,
  disabled = false,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Adjust position if tooltip would go off-screen
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current.getBoundingClientRect();
    const trigger = triggerRef.current.getBoundingClientRect();
    const padding = 8;

    let newPosition = position;

    // Check if tooltip goes off-screen and adjust
    if (position === "top" && trigger.top - tooltip.height - padding < 0) {
      newPosition = "bottom";
    } else if (
      position === "bottom" &&
      trigger.bottom + tooltip.height + padding > window.innerHeight
    ) {
      newPosition = "top";
    } else if (
      position === "left" &&
      trigger.left - tooltip.width - padding < 0
    ) {
      newPosition = "right";
    } else if (
      position === "right" &&
      trigger.right + tooltip.width + padding > window.innerWidth
    ) {
      newPosition = "left";
    }

    setTooltipPosition(newPosition);
  }, [isVisible, position]);

  const showTooltip = () => {
    if (disabled) return;
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
  // give the trigger an explicit toggle too. Desktop hover/focus behavior
  // above is unchanged.
  const toggleTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible((visible) => !visible);
  };

  const positionStyles: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles: Record<TooltipPosition, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-inverse-surface border-x-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-inverse-surface border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-inverse-surface border-y-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-inverse-surface border-y-transparent border-l-transparent",
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onClick={toggleTooltip}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          // Stops the trigger's onClick toggle from also firing when the
          // tap lands on the tooltip body itself — it's a DOM child of the
          // trigger, so without this a tap inside the content self-closes it.
          onClick={(e) => e.stopPropagation()}
          className={`
            absolute z-50 ${positionStyles[tooltipPosition]}
            px-3 py-1.5 text-xs font-medium
            bg-inverse-surface text-inverse-on-surface
            rounded-lg shadow-lg
            animate-in fade-in zoom-in-95 duration-150
            whitespace-nowrap
            ${className}
          `}
        >
          {content}
          {/* Arrow */}
          <span
            className={`
              absolute w-0 h-0
              border-4 ${arrowStyles[tooltipPosition]}
            `}
          />
        </div>
      )}
    </div>
  );
};
