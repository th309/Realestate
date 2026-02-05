'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  separator?: React.ReactNode;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  separator,
  className = '',
}) => {
  const allItems = showHome
    ? [{ label: 'Home', href: '/', icon: <Home className="w-4 h-4" /> }, ...items]
    : items;

  const Separator = separator || <ChevronRight className="w-4 h-4 text-on-surface-variant" />;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 flex-wrap">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && <span className="mx-1">{Separator}</span>}

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`
                    flex items-center gap-1.5 text-sm
                    ${isLast ? 'text-on-surface font-medium' : 'text-on-surface-variant'}
                  `}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Breadcrumb with dropdown for long paths
interface CollapsibleBreadcrumbsProps extends BreadcrumbsProps {
  maxVisible?: number;
}

export const CollapsibleBreadcrumbs: React.FC<CollapsibleBreadcrumbsProps> = ({
  items,
  showHome = true,
  maxVisible = 3,
  className = '',
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const allItems = showHome
    ? [{ label: 'Home', href: '/', icon: <Home className="w-4 h-4" /> }, ...items]
    : items;

  if (allItems.length <= maxVisible || expanded) {
    return (
      <Breadcrumbs items={items} showHome={showHome} className={className} />
    );
  }

  // Show first, ellipsis, and last (maxVisible - 1) items
  const firstItem = allItems[0];
  const lastItems = allItems.slice(-(maxVisible - 1));
  const hiddenItems = allItems.slice(1, -(maxVisible - 1));

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 flex-wrap">
        {/* First item */}
        <li className="flex items-center gap-1">
          <Link
            href={firstItem.href || '/'}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            {firstItem.icon}
            <span>{firstItem.label}</span>
          </Link>
        </li>

        {/* Ellipsis / hidden items dropdown */}
        <li className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-on-surface-variant mx-1" />
          <div className="relative">
            <button
              onClick={() => setExpanded(true)}
              className="px-2 py-0.5 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition-colors"
            >
              ...
            </button>
          </div>
        </li>

        {/* Last items */}
        {lastItems.map((item, index) => {
          const isLast = index === lastItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-on-surface-variant mx-1" />

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`
                    flex items-center gap-1.5 text-sm
                    ${isLast ? 'text-on-surface font-medium' : 'text-on-surface-variant'}
                  `}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Page header with breadcrumbs
interface PageHeaderWithBreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeaderWithBreadcrumbs: React.FC<PageHeaderWithBreadcrumbsProps> = ({
  breadcrumbs,
  title,
  description,
  icon,
  actions,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon && (
              <div className="p-2 bg-primary-container rounded-xl text-on-primary-container">
                {icon}
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-medium text-on-surface tracking-tight">
              {title}
            </h1>
          </div>
          {description && (
            <p className="text-sm text-on-surface-variant mt-1">{description}</p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
