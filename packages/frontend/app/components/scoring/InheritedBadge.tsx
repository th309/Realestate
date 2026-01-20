/**
 * InheritedBadge Component
 *
 * Small indicator showing that a metric value was inherited
 * from a parent geography (County, Metro, State, or National).
 * Displays a tooltip with the source geography name.
 */

'use client';

import { memo, useState, useRef, useEffect } from 'react';

type GeographyLevel = 'county' | 'metro' | 'state' | 'national';

interface InheritedBadgeProps {
  sourceType: GeographyLevel;
  sourceName?: string;
  className?: string;
}

/**
 * Get human-readable label for geography level
 */
function getSourceLabel(type: GeographyLevel): string {
  switch (type) {
    case 'county':
      return 'County';
    case 'metro':
      return 'Metro';
    case 'state':
      return 'State';
    case 'national':
      return 'National';
    default:
      return 'Parent';
  }
}

/**
 * Get color for the badge based on geography level
 */
function getBadgeColor(type: GeographyLevel): string {
  switch (type) {
    case 'county':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'metro':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'state':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'national':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-surface-container text-on-surface-variant border-outline-variant';
  }
}

/**
 * Inheritance icon (arrow pointing up)
 */
function InheritanceIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-3 h-3 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </svg>
  );
}

export const InheritedBadge = memo(function InheritedBadge({
  sourceType,
  sourceName,
  className = '',
}: InheritedBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');

  // Calculate tooltip position based on available space
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      setTooltipPosition(spaceAbove < 60 ? 'bottom' : 'top');
    }
  }, [showTooltip]);

  const label = getSourceLabel(sourceType);
  const tooltipText = sourceName
    ? `Inherited from ${label}: ${sourceName}`
    : `Inherited from ${label} level`;

  return (
    <span
      ref={badgeRef}
      className={`
        relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium
        border cursor-help
        ${getBadgeColor(sourceType)}
        ${className}
      `}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={tooltipText}
    >
      <InheritanceIcon />
      <span className="sr-only">{tooltipText}</span>

      {/* Tooltip */}
      {showTooltip && (
        <span
          className={`
            absolute left-1/2 -translate-x-1/2 z-50
            px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap
            ${tooltipPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
          `}
          role="tooltip"
        >
          {tooltipText}
          {/* Arrow */}
          <span
            className={`
              absolute left-1/2 -translate-x-1/2 border-4 border-transparent
              ${tooltipPosition === 'top' ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'}
            `}
          />
        </span>
      )}
    </span>
  );
});

export default InheritedBadge;
