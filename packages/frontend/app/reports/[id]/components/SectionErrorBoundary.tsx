'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Unique identifier for this section, used for error logging and UI */
  sectionId: string;
  /** Optional custom fallback UI. If not provided, uses default error display. */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Converts snake_case or kebab-case section ID to human-readable Title Case
 */
function formatSectionName(sectionId: string): string {
  return sectionId
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Default fallback UI for section errors
 */
function DefaultSectionErrorFallback({
  sectionId,
  error
}: {
  sectionId: string;
  error?: Error;
}) {
  const handleRetry = () => {
    // Reload the page to attempt recovery
    window.location.reload();
  };

  return (
    <div
      className="p-6 border border-error/30 rounded-2xl bg-error/5"
      role="alert"
      aria-label={`Error in ${formatSectionName(sectionId)} section`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-error"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-medium text-error">
            Unable to load {formatSectionName(sectionId)}
          </p>
          {error?.message && (
            <p className="text-sm text-error/70 mt-1">
              {error.message}
            </p>
          )}
        </div>
        <button
          onClick={handleRetry}
          className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/**
 * Error boundary specifically designed for report section components.
 *
 * Catches JavaScript errors in section components and displays a graceful
 * fallback UI, preventing the entire report from crashing.
 *
 * Features:
 * - Catches errors in child component tree
 * - Displays a user-friendly error message
 * - Logs error details for debugging
 * - Allows the rest of the report to continue rendering
 * - Supports custom fallback UI
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SectionErrorBoundary sectionId="market-conditions">
 *   <MarketConditionsSection report={report} />
 * </SectionErrorBoundary>
 *
 * // With custom fallback
 * <SectionErrorBoundary
 *   sectionId="affordability"
 *   fallback={<CustomErrorUI />}
 * >
 *   <AffordabilitySection report={report} />
 * </SectionErrorBoundary>
 *
 * // With error callback
 * <SectionErrorBoundary
 *   sectionId="investment-thesis"
 *   onError={(error, info) => sendToErrorTracking(error, info)}
 * >
 *   <InvestmentThesisSection report={report} />
 * </SectionErrorBoundary>
 * ```
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Log error details for debugging
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { sectionId, onError } = this.props;

    // Log error with section context for debugging
    console.error(
      `[SectionErrorBoundary] Error in section "${sectionId}":`,
      error
    );
    console.error('Component stack:', errorInfo.componentStack);

    // Call optional error callback (e.g., for error tracking services)
    onError?.(error, errorInfo);
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, sectionId, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided, otherwise use default
      return fallback ?? (
        <DefaultSectionErrorFallback sectionId={sectionId} error={error} />
      );
    }

    return children;
  }
}

/**
 * Re-export the default fallback component for use in custom error UIs
 */
export { DefaultSectionErrorFallback };
