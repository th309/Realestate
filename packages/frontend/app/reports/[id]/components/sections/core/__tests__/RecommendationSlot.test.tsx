import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RecommendationSlot } from '../RecommendationSlot';

import type { ReportInstance } from '../../../../../types';

/**
 * Builds a minimal ReportInstance with optional recommendations data.
 * Only populates the fields RecommendationSlot accesses.
 */
function buildReport(
  recommendations?: Record<string, any> | null
): ReportInstance {
  return {
    id: 'test-report-001',
    template_id: 'tmpl-001',
    template_version: 1,
    user_id: 'user-001',
    organization_id: null,
    user_type: 'homebuyer',
    title: 'Test Report',
    primary_geography_id: 'cbsa-12420',
    primary_geography_type: 'metro',
    primary_geography_name: 'Austin, TX',
    comparison_geographies: null,
    user_inputs: {},
    populated_data: {
      current: {},
      historical: {},
      benchmarks: {},
      scores: {},
      recommendations: recommendations ?? undefined,
    },
    ai_narratives: null,
    homeready_score: 72,
    investoredge_score: null,
    status: 'ready',
    error_message: null,
    data_as_of_date: '2026-02-01',
    confidence_level: 'high',
    generation_time_ms: 1200,
    share_token: null,
    share_access_level: 'view',
    share_view_count: 0,
    created_at: '2026-02-15T12:00:00Z',
    updated_at: '2026-02-15T12:00:00Z',
    expires_at: null,
    last_viewed_at: null,
  };
}

const sampleRecommendation = {
  name: 'RateShield Mortgage',
  description: 'Lock in today\'s rates with a free pre-approval in minutes.',
  cta_text: 'Get Pre-Approved',
  cta_url: 'https://example.com/rateshield?ref=piq',
  logo_url: 'https://example.com/logo.png',
};

describe('RecommendationSlot', () => {
  describe('self-hiding behavior', () => {
    it('returns null when recommendation is undefined for the context type', () => {
      const report = buildReport({});
      const { container } = render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('returns null when recommendation is null for the context type', () => {
      const report = buildReport({ affordability: null });
      const { container } = render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('returns null when populated_data is null', () => {
      const report = buildReport();
      // Force populated_data to null
      (report as any).populated_data = null;
      const { container } = render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('returns null when populated_data.recommendations is undefined', () => {
      const report = buildReport();
      // Remove recommendations key entirely
      delete (report.populated_data as any).recommendations;
      const { container } = render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('rendering with recommendation data', () => {
    it('renders the partner name', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(screen.getByText('RateShield Mortgage')).toBeInTheDocument();
    });

    it('renders the description', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(
        screen.getByText("Lock in today's rates with a free pre-approval in minutes.")
      ).toBeInTheDocument();
    });

    it('renders the CTA button text', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(screen.getByText('Get Pre-Approved')).toBeInTheDocument();
    });

    it('renders the CTA link with correct URL', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      const link = screen.getByRole('link', { name: /Get Pre-Approved/i });
      expect(link).toHaveAttribute('href', 'https://example.com/rateshield?ref=piq');
    });

    it('CTA link opens in a new tab', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      const link = screen.getByRole('link', { name: /Get Pre-Approved/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the "Recommended next step" label', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(screen.getByText('Recommended next step')).toBeInTheDocument();
    });

    it('renders the disclosure text', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(
        screen.getByText('PropertyIQ may receive compensation from partners.')
      ).toBeInTheDocument();
    });

    it('has the correct aria-label on the complementary region', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      const region = screen.getByRole('complementary');
      expect(region).toHaveAttribute('aria-label', 'Partner recommendation');
    });
  });

  describe('logo rendering', () => {
    it('renders logo image when logo_url is provided', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      const img = screen.getByRole('img', { name: 'RateShield Mortgage logo' });
      expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
    });

    it('does not render logo when logo_url is not provided', () => {
      const noLogoRec = { ...sampleRecommendation, logo_url: undefined };
      const report = buildReport({ affordability: noLogoRec });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className to the container', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot
          contextType="affordability"
          report={report}
          className="mt-6"
        />
      );
      const region = screen.getByRole('complementary');
      expect(region.className).toContain('mt-6');
    });

    it('works without className prop', () => {
      const report = buildReport({ affordability: sampleRecommendation });
      render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });
  });

  describe('context type matching', () => {
    it('renders only for the matching context type', () => {
      const report = buildReport({
        affordability: sampleRecommendation,
        timing: null,
      });
      const { container: visible } = render(
        <RecommendationSlot contextType="affordability" report={report} />
      );
      expect(visible.innerHTML).not.toBe('');

      const { container: hidden } = render(
        <RecommendationSlot contextType="timing" report={report} />
      );
      expect(hidden.innerHTML).toBe('');
    });
  });
});
