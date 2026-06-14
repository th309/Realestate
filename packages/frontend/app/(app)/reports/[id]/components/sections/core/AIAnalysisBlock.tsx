'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export type AIAnalysisVariant = 'insight' | 'summary' | 'recommendation';

export interface AIAnalysisBlockProps {
  /** The AI-generated content to display. Can be a single string or array of paragraphs. */
  content: string | string[];
  /** Optional title to display above the content */
  title?: string;
  /** Visual variant that determines the styling */
  variant?: AIAnalysisVariant;
  /** Optional additional CSS classes */
  className?: string;
  /** When true and content is empty, show an upgrade hint instead of returning null */
  showUpgradeHint?: boolean;
}

/**
 * Variant-specific styling configurations using report-theme.css classes
 */
const VARIANT_STYLES: Record<AIAnalysisVariant, {
  container: string;
  title: string;
  text: string;
}> = {
  insight: {
    container: 'bg-[var(--report-cream-dark)] border border-[rgba(27,46,74,0.06)] rounded-[var(--report-radius-md)]',
    title: 'text-[var(--report-navy)] font-semibold',
    text: 'text-[var(--report-navy)]',
  },
  summary: {
    container: 'bg-white border border-[rgba(27,46,74,0.04)] rounded-[var(--report-radius-md)]',
    title: 'text-[var(--report-navy)] font-semibold',
    text: 'text-[var(--report-stone)]',
  },
  recommendation: {
    container: 'bg-white border-l-4 border-l-[var(--report-gold)] border border-[rgba(27,46,74,0.04)] rounded-[var(--report-radius-md)]',
    title: 'text-[var(--report-navy)] font-semibold',
    text: 'text-[var(--report-navy-light)] font-medium',
  },
};

/**
 * AIAnalysisBlock - Displays AI-generated analysis content with appropriate styling
 *
 * A shared primitive component for rendering AI-generated text such as insights,
 * summaries, or recommendations. Includes a subtle AI indicator badge and
 * supports different visual variants for various content types.
 *
 * Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { AIAnalysisBlock } from './core/AIAnalysisBlock';
 *
 * // Single paragraph insight
 * <AIAnalysisBlock
 *   content="This market shows strong appreciation potential..."
 *   variant="insight"
 * />
 *
 * // Multiple paragraphs with title
 * <AIAnalysisBlock
 *   title="Market Summary"
 *   content={['First insight...', 'Second insight...']}
 *   variant="summary"
 * />
 *
 * // Recommendation with emphasis
 * <AIAnalysisBlock
 *   title="Our Recommendation"
 *   content="Consider investing in this area due to..."
 *   variant="recommendation"
 * />
 * ```
 */
export function AIAnalysisBlock({
  content,
  title,
  variant = 'insight',
  className = '',
  showUpgradeHint = false,
}: AIAnalysisBlockProps): React.ReactElement | null {
  const styles = VARIANT_STYLES[variant];

  // Normalize content to array
  const paragraphs = Array.isArray(content) ? content : [content];

  // Filter out empty content
  const validParagraphs = paragraphs.filter(
    (p) => typeof p === 'string' && p.trim() !== ''
  );

  // Show upgrade hint when content is empty
  if (validParagraphs.length === 0) {
    if (showUpgradeHint) {
      return (
        <div
          className={`p-[var(--report-space-lg)] bg-[var(--report-cream)] border border-dashed border-[rgba(27,46,74,0.12)] rounded-[var(--report-radius-md)] ${className}`.trim()}
          role="region"
          aria-label="AI Analysis Upgrade"
        >
          <div className="flex items-center justify-between gap-2 text-[var(--report-stone-light)]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                AI-powered analysis is available with a Pro plan.
              </p>
            </div>
            <Link
              href="/pricing#reports"
              className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap hover:opacity-80 transition-opacity"
              style={{ color: 'var(--report-navy)' }}
            >
              See sample <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={`p-[var(--report-space-lg)] ${styles.container} ${className}`.trim()}
      role="region"
      aria-label={title || 'AI Analysis'}
    >
      {/* Header with optional title and AI badge */}
      <div className="flex items-center justify-between mb-[var(--report-space-sm)]">
        {title && (
          <h3 className={`text-base ${styles.title}`}>
            {title}
          </h3>
        )}
        <div
          className="flex items-center gap-1 text-[0.6875rem] font-medium tracking-wide uppercase text-[var(--report-stone-light)] bg-[var(--report-cream)] px-2 py-1 rounded-full ml-auto"
          aria-label="AI Generated Content"
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          <span>AI</span>
        </div>
      </div>

      {/* Content - rendered as markdown */}
      <div className={`prose prose-sm max-w-none ${styles.text} [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:text-[0.9375rem] [&_p]:leading-relaxed [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:pl-5 [&_li]:text-[0.9375rem] [&_li]:leading-relaxed [&_li]:mb-1`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {validParagraphs.join('\n\n')}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default AIAnalysisBlock;
