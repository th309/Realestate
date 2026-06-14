'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SectionCardProps {
  /** Section title displayed in the header */
  title: string;
  /** Optional Lucide icon component to display alongside the title */
  icon?: LucideIcon;
  /** Content to render inside the card body */
  children: React.ReactNode;
  /** Optional additional CSS classes to apply to the card container */
  className?: string;
}

/**
 * SectionCard - A reusable card wrapper for report sections
 *
 * Uses the editorial design system from report-theme.css with
 * warm neutrals, refined typography, and elegant spacing.
 *
 * @example
 * ```tsx
 * import { SectionCard } from './core/SectionCard';
 * import { TrendingUp } from 'lucide-react';
 *
 * <SectionCard title="Market Overview" icon={TrendingUp}>
 *   <p>Your content here...</p>
 * </SectionCard>
 * ```
 */
export function SectionCard({
  title,
  icon: Icon,
  children,
  className = '',
}: SectionCardProps): React.ReactElement {
  return (
    <section className={`report-section report-animate-in ${className}`.trim()}>
      <header className="report-section-header">
        {Icon && (
          <div className="report-section-icon">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
        <h2 className="report-heading-md">{title}</h2>
      </header>
      <div className="report-body">
        {children}
      </div>
    </section>
  );
}

export default SectionCard;
