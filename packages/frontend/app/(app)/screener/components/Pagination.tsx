"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
}: PaginationProps) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <p className="text-sm text-on-surface-variant">
        {total === 0 ? (
          "No results"
        ) : (
          <>
            Showing{" "}
            <span className="font-[family-name:var(--font-roboto-mono)] font-medium text-on-surface">
              {from}–{to}
            </span>{" "}
            of{" "}
            <span className="font-[family-name:var(--font-roboto-mono)] font-medium text-on-surface">
              {total.toLocaleString()}
            </span>
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="
            inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
            border border-outline-variant transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            enabled:hover:bg-surface-container enabled:hover:border-primary enabled:hover:text-primary
            text-on-surface-variant
          "
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <span className="text-xs text-on-surface-variant px-1 font-[family-name:var(--font-roboto-mono)]">
          {page + 1}
        </span>

        <button
          type="button"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="
            inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
            border border-outline-variant transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            enabled:hover:bg-surface-container enabled:hover:border-primary enabled:hover:text-primary
            text-on-surface-variant
          "
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
