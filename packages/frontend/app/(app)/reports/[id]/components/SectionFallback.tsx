'use client';

import React from 'react';

/**
 * Converts snake_case section type to human-readable Title Case
 */
function formatSectionName(sectionType: string): string {
  return sectionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface SectionFallbackProps {
  sectionType: string;
}

/**
 * Placeholder for sections that haven't been implemented yet
 */
export function SectionFallback({ sectionType }: SectionFallbackProps) {
  return (
    <div className="p-6 border border-dashed border-outline-variant rounded-2xl bg-surface-container">
      <p className="text-on-surface-variant text-center">
        <span className="font-medium text-on-surface">{formatSectionName(sectionType)}</span>
        <br />
        <span className="text-sm">Coming soon</span>
      </p>
    </div>
  );
}

interface SectionErrorProps {
  sectionType: string;
  error?: Error | null;
}

/**
 * Error state for sections that failed to render
 */
export function SectionError({ sectionType, error }: SectionErrorProps) {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="p-6 border border-error/30 rounded-2xl bg-error/5">
      <p className="text-error text-center">
        <span className="font-medium">Unable to load {formatSectionName(sectionType)}</span>
        <br />
        {error?.message && (
          <span className="text-sm text-error/70">{error.message}</span>
        )}
      </p>
      <div className="text-center mt-3">
        <button
          onClick={handleRetry}
          className="text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
