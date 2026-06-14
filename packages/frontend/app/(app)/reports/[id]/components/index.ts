/**
 * Report Section Rendering Components
 *
 * This module provides dynamic template-based section rendering for reports.
 * Sections are rendered based on template configuration with graceful fallbacks
 * and per-section error boundaries.
 */

export { ErrorBoundary } from './ErrorBoundary';
export { SectionFallback, SectionError } from './SectionFallback';
export { BrandingProvider, useBranding } from './BrandingProvider';
export type { BrandingConfig } from './BrandingProvider';
export { SectionRenderer, PageRenderer } from './SectionRenderer';
export type { SectionProps, ReportWithTemplate } from './types';
