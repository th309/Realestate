import React from "react";

export interface EmbedErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * EmbedErrorState — Friendly error display for embed widgets.
 *
 * Shows a warning icon, error message, and optional retry button.
 * Compact design sized for ~280px embed containers.
 */
export function EmbedErrorState({
  message = "Something went wrong",
  onRetry,
}: EmbedErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[200px]">
      {/* Warning icon (Material Symbols style) */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        className="text-on-surface-variant opacity-60"
      >
        <path
          d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
          fill="currentColor"
        />
      </svg>

      <p className="text-sm text-on-surface-variant leading-snug max-w-[240px]">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-sm font-medium rounded-full
                     bg-primary text-on-primary
                     hover:opacity-90 transition-opacity duration-200"
        >
          Try again
        </button>
      )}
    </div>
  );
}
