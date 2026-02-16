import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ComponentScoreBadge } from '../ComponentScoreBadge';

import type { ComponentStatus } from '@/lib/data';

describe('ComponentScoreBadge', () => {
  const defaultProps = {
    component: 'affordability',
    score: 72,
    label: 'Affordability',
    status: 'strong' as ComponentStatus,
  };

  describe('rendering with score and label', () => {
    it('displays the numeric score', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('displays the label text', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      expect(screen.getByText('Affordability')).toBeInTheDocument();
    });

    it('displays the formatted status text', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      expect(screen.getByText('Strong')).toBeInTheDocument();
    });

    it('sets the correct aria-label on the region', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const region = screen.getByRole('region');
      expect(region).toHaveAttribute(
        'aria-label',
        'Affordability: score 72 out of 100, status strong'
      );
    });

    it('renders an SVG with the correct aria-label for the score ring', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('aria-label', 'Affordability score: 72');
    });
  });

  describe('status color mapping', () => {
    it('uses success color for "excellent" status', () => {
      render(
        <ComponentScoreBadge {...defaultProps} status="excellent" />
      );
      // The status pill should have success background
      const pill = screen.getByText('Excellent');
      expect(pill).toHaveStyle({ backgroundColor: 'var(--report-success-bg)' });
      expect(pill).toHaveStyle({ color: 'var(--report-success)' });
    });

    it('uses success color for "strong" status', () => {
      render(
        <ComponentScoreBadge {...defaultProps} status="strong" />
      );
      const pill = screen.getByText('Strong');
      expect(pill).toHaveStyle({ backgroundColor: 'var(--report-success-bg)' });
      expect(pill).toHaveStyle({ color: 'var(--report-success)' });
    });

    it('uses warning color for "moderate" status', () => {
      render(
        <ComponentScoreBadge {...defaultProps} status="moderate" />
      );
      const pill = screen.getByText('Moderate');
      expect(pill).toHaveStyle({ backgroundColor: 'var(--report-warning-bg)' });
      expect(pill).toHaveStyle({ color: 'var(--report-warning)' });
    });

    it('uses error color for "watch" status', () => {
      render(
        <ComponentScoreBadge {...defaultProps} status="watch" />
      );
      const pill = screen.getByText('Watch');
      expect(pill).toHaveStyle({ backgroundColor: 'var(--report-error-bg)' });
      expect(pill).toHaveStyle({ color: 'var(--report-error)' });
    });

    it('uses error color for "concern" status', () => {
      render(
        <ComponentScoreBadge {...defaultProps} status="concern" />
      );
      const pill = screen.getByText('Concern');
      expect(pill).toHaveStyle({ backgroundColor: 'var(--report-error-bg)' });
      expect(pill).toHaveStyle({ color: 'var(--report-error)' });
    });
  });

  describe('compact variant', () => {
    it('renders a smaller ring when compact is true', () => {
      render(<ComponentScoreBadge {...defaultProps} compact />);
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('width', '40');
      expect(svg).toHaveAttribute('height', '40');
    });

    it('renders a larger ring when compact is false (default)', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('width', '60');
      expect(svg).toHaveAttribute('height', '60');
    });

    it('uses smaller text class for score when compact', () => {
      render(<ComponentScoreBadge {...defaultProps} compact />);
      // The score text element should have text-sm for compact
      const scoreText = screen.getByText('72');
      expect(scoreText).toHaveClass('text-sm');
    });

    it('uses larger text class for score in default variant', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const scoreText = screen.getByText('72');
      expect(scoreText).toHaveClass('text-lg');
    });

    it('uses smaller text class for label when compact', () => {
      render(<ComponentScoreBadge {...defaultProps} compact />);
      const label = screen.getByText('Affordability');
      expect(label).toHaveClass('text-sm');
    });

    it('uses default text class for label when not compact', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const label = screen.getByText('Affordability');
      expect(label).toHaveClass('text-base');
    });
  });

  describe('optional props', () => {
    it('renders without className prop', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ComponentScoreBadge {...defaultProps} className="my-custom-class" />);
      const region = screen.getByRole('region');
      expect(region).toHaveClass('my-custom-class');
    });

    it('defaults compact to false', () => {
      render(<ComponentScoreBadge {...defaultProps} />);
      const svg = screen.getByRole('img');
      // Default (non-compact) size should be 60
      expect(svg).toHaveAttribute('width', '60');
    });
  });

  describe('score edge cases', () => {
    it('renders score of 0', () => {
      render(<ComponentScoreBadge {...defaultProps} score={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders score of 100', () => {
      render(<ComponentScoreBadge {...defaultProps} score={100} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('clamps the progress ring for scores above 100', () => {
      // The component does Math.min(score, 100) for the ring calculation
      // So it should still render without error
      render(<ComponentScoreBadge {...defaultProps} score={120} />);
      expect(screen.getByText('120')).toBeInTheDocument();
    });
  });
});
