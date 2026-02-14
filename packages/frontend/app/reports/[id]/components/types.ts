import { ReportInstance, ReportSection } from '../../types';
import { BrandingConfig } from './BrandingProvider';

/**
 * Standard props passed to all section components
 */
export interface SectionProps {
  /** The section configuration from the template */
  section: ReportSection;
  /** The full report data */
  report: ReportInstance;
  /** Optional branding configuration for white-label */
  branding?: BrandingConfig;
}

/**
 * Template for a report with template info included
 */
export interface ReportWithTemplate extends ReportInstance {
  template?: {
    slug: string;
    name: string;
    icon: string;
    config: {
      report_type?: 'snapshot' | 'comparison' | 'investment' | 'affordability' | 'cycle';
      pages: Array<{
        id: string;
        name: string;
        layout?: string;
        sections: ReportSection[];
      }>;
    };
  };
}

export type { BrandingConfig };
