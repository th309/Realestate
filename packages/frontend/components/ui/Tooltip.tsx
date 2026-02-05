'use client';

import React, { useState, useRef, useEffect } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

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
  position = 'top',
  delay = 200,
  disabled = false,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>(position);
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
    if (position === 'top' && trigger.top - tooltip.height - padding < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && trigger.bottom + tooltip.height + padding > window.innerHeight) {
      newPosition = 'top';
    } else if (position === 'left' && trigger.left - tooltip.width - padding < 0) {
      newPosition = 'right';
    } else if (position === 'right' && trigger.right + tooltip.width + padding > window.innerWidth) {
      newPosition = 'left';
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

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowStyles: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-inverse-surface border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-inverse-surface border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-inverse-surface border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-inverse-surface border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
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
  position = 'top',
  delay = 200,
  maxWidth = 280,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
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

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
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
  position = 'bottom',
  className = '',
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  const toggleOpen = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-0 mr-2',
    right: 'left-full top-0 ml-2',
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

// Info Icon Tooltip (common pattern)
interface InfoTooltipProps {
  content: string;
  position?: TooltipPosition;
  size?: 'sm' | 'md';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  position = 'top',
  size = 'sm',
}) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

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
