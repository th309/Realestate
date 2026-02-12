'use client';

import React from 'react';
import Link from 'next/link';
import { Tooltip } from './Tooltip';
import { getMetricDefinition } from '@/app/map/data/metricDefinitions';
import { getMetricTitle } from '@/lib/data';

export interface MetricLinkProps {
  /** The metric ID to link to */
  metricId: string;
  /** Optional custom label, defaults to metric title */
  children?: React.ReactNode;
  /** Show hover tooltip with brief description (default true) */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to open in a new tab */
  openInNewTab?: boolean;
}

/**
 * MetricLink - A clickable link component for metric names
 *
 * Features:
 * - Hover: Shows a tooltip with brief description
 * - Click: Navigates to /metrics/[metricId] page
 * - Accessible: Proper aria labels, keyboard navigation
 */
export const MetricLink: React.FC<MetricLinkProps> = ({
  metricId,
  children,
  showTooltip = true,
  className = '',
  openInNewTab = false,
}) => {
  const metricDef = getMetricDefinition(metricId);
  const title = metricDef?.name || getMetricTitle(metricId) || metricId;

  // Truncate description for tooltip (max 150 chars)
  const tooltipContent = metricDef?.description
    ? metricDef.description.length > 150
      ? metricDef.description.substring(0, 147) + '...'
      : metricDef.description
    : `View details about ${title}`;

  const linkContent = (
    <Link
      href={`/metrics/${metricId}`}
      className={`
        inline-flex items-center gap-0.5
        text-primary hover:text-primary/80
        underline decoration-primary/30 hover:decoration-primary/60
        decoration-dotted underline-offset-2
        transition-colors duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        cursor-pointer
        ${className}
      `}
      aria-label={`View details about ${title}`}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
    >
      {children || title}
    </Link>
  );

  if (!showTooltip) {
    return linkContent;
  }

  return (
    <Tooltip content={tooltipContent} position="top" delay={300}>
      {linkContent}
    </Tooltip>
  );
};

/**
 * MetricLinkInline - Same as MetricLink but inherits parent text styles
 * Use this when you want the link to blend in with surrounding text
 */
export const MetricLinkInline: React.FC<MetricLinkProps> = ({
  className = '',
  ...props
}) => {
  return (
    <MetricLink
      {...props}
      className={`
        text-inherit font-inherit
        hover:text-primary
        ${className}
      `}
    />
  );
};

export default MetricLink;
