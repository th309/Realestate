'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface WidgetShellProps {
  title: string;
  icon: LucideIcon;
  href: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}

export function WidgetShell({
  title,
  icon: Icon,
  href,
  loading,
  error,
  children,
}: WidgetShellProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-on-surface-variant" />
          <span className="text-sm font-medium text-on-surface">{title}</span>
        </div>
        <Link
          href={href}
          className="text-xs text-primary hover:underline"
        >
          View all &rarr;
        </Link>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-surface-container-high rounded animate-pulse" />
            <div className="h-4 bg-surface-container-high rounded animate-pulse w-4/5" />
            <div className="h-4 bg-surface-container-high rounded animate-pulse w-3/5" />
          </div>
        ) : error ? (
          <div className="bg-error-container/30 rounded-lg p-3 text-xs text-error">
            {error}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
