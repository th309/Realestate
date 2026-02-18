'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  getMetricDefinition,
  getDataSourceAnchor,
  getMetricTitle,
  getMetricDataDate,
  formatDataDateForDisplay,
} from '@/lib/data';

interface MetricTitleProps {
  metricId: string;
  className?: string;
  as?: 'span' | 'h3' | 'h4' | 'div';
  showTooltip?: boolean;
}

// Global singleton: only one tooltip at a time
let globalCloseTooltip: (() => void) | null = null;

export function MetricTitle({
  metricId,
  className = '',
  as: Tag = 'span',
  showTooltip = true,
}: MetricTitleProps) {
  const metricDef = getMetricDefinition(metricId);
  const title = metricDef?.name || getMetricTitle(metricId) || metricId;

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const closeTooltip = useCallback(() => {
    setIsOpen(false);
    if (globalCloseTooltip === closeTooltip) {
      globalCloseTooltip = null;
    }
  }, []);

  const calculatePosition = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const tooltipWidth = 288;
    const tooltipHeight = 240;
    const gap = 12;
    const margin = 8;

    // Try to place to the RIGHT of the trigger
    let left = rect.right + gap;
    let top = rect.top;

    // If it overflows the right edge, place to the LEFT instead
    if (left + tooltipWidth + margin > window.innerWidth) {
      left = rect.left - tooltipWidth - gap;
    }

    // If it overflows the left edge too, fall back to right-aligned with screen edge
    if (left < margin) {
      left = margin;
    }

    // Vertical: keep top aligned with trigger, clamp to viewport
    if (top + tooltipHeight + margin > window.innerHeight) {
      top = window.innerHeight - tooltipHeight - margin;
    }
    if (top < margin) {
      top = margin;
    }

    setPosition({ top, left });
  }, []);

  const handleInfoClick = useCallback((e: React.MouseEvent) => {
    // Stop propagation so parent click handlers (metric switching) don't fire
    e.stopPropagation();
    e.preventDefault();
    if (!showTooltip || !metricDef) return;
    if (isOpen) {
      closeTooltip();
    } else {
      // Close any other open tooltip
      if (globalCloseTooltip && globalCloseTooltip !== closeTooltip) {
        globalCloseTooltip();
      }
      globalCloseTooltip = closeTooltip;
      calculatePosition();
      setIsOpen(true);
    }
  }, [showTooltip, metricDef, isOpen, closeTooltip, calculatePosition]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        iconRef.current && !iconRef.current.contains(e.target as Node)
      ) {
        closeTooltip();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeTooltip]);

  const hasTooltip = showTooltip && !!metricDef;
  const dataSourceAnchor = metricDef ? getDataSourceAnchor(metricId) : undefined;
  const dataDate = formatDataDateForDisplay(getMetricDataDate(metricId));

  return (
    <>
      <Tag className={`inline-flex items-center min-w-0 max-w-full ${className}`}>
        <span className="truncate">{title}</span>
        {hasTooltip && (
          <span
            ref={iconRef}
            role="button"
            tabIndex={0}
            onClick={handleInfoClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInfoClick(e as unknown as React.MouseEvent); } }}
            className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 align-middle text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-150 cursor-pointer shrink-0"
            aria-label={`Info about ${title}`}
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 7h1.5v4h-1.5V7zm0-2.5h1.5V6h-1.5V4.5z" />
            </svg>
          </span>
        )}
      </Tag>

      {isOpen && metricDef && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className="fixed w-72 bg-surface-container-lowest rounded-[28px] elevation-3 border border-outline-variant p-3 text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: position.top,
            left: position.left,
            zIndex: 99999,
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-on-surface">{metricDef.name}</h4>
            <button
              onClick={closeTooltip}
              className="text-on-surface-variant hover:text-on-surface text-lg leading-none transition-colors duration-200"
            >
              &times;
            </button>
          </div>

          <p className="text-on-surface-variant mb-3">{metricDef.description}</p>

          {metricDef.formula && (
            <div className="mb-2">
              <span className="font-medium text-on-surface">Formula: </span>
              <span className="text-on-surface-variant font-mono text-[11px] bg-surface-container px-1 py-0.5 rounded">
                {metricDef.formula}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant border-t border-outline-variant pt-2 mt-2">
            <span><span className="font-medium">Source:</span> {metricDef.dataSource}</span>
            <span><span className="font-medium">Updates:</span> {metricDef.updateFrequency}</span>
            <span><span className="font-medium">As of:</span> {dataDate}</span>
          </div>

          {metricDef.notes && (
            <p className="text-[11px] text-on-surface-variant/70 italic mt-2">{metricDef.notes}</p>
          )}

          {dataSourceAnchor && (
            <Link
              href={`/data#${dataSourceAnchor}`}
              className="mt-3 flex items-center justify-center gap-1 w-full py-1.5 text-[11px] font-medium text-primary hover:text-primary/80 hover:bg-primary-container/30 rounded-lg transition-colors duration-200"
              onClick={closeTooltip}
            >
              View data source
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default MetricTitle;
