import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  describe('Value Display', () => {
    it('displays the label correctly', () => {
      render(<StatCard label="Current" value="$425,000" />);
      expect(screen.getByTestId('stat-card-label')).toHaveTextContent('Current');
    });

    it('displays the value correctly', () => {
      render(<StatCard label="Current" value="$425,000" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('$425,000');
    });

    it('displays formatted currency value', () => {
      render(<StatCard label="Price" value="$1,234,567" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('$1,234,567');
    });

    it('displays formatted percent value', () => {
      render(<StatCard label="Change" value="5.25%" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('5.25%');
    });

    it('displays formatted number with separator', () => {
      render(<StatCard label="Population" value="1,234,567" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('1,234,567');
    });

    it('displays N/A when value is N/A', () => {
      render(<StatCard label="Current" value="N/A" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('N/A');
    });
  });

  describe('Subtext Display', () => {
    it('displays subtext when provided', () => {
      render(<StatCard label="Current" value="$425,000" subtext="As of Jan 2024" />);
      expect(screen.getByTestId('stat-card-subtext')).toHaveTextContent('As of Jan 2024');
    });

    it('does not display subtext when not provided', () => {
      render(<StatCard label="Current" value="$425,000" />);
      expect(screen.queryByTestId('stat-card-subtext')).not.toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('shows green up arrow for positive trend', () => {
      render(
        <StatCard
          label="Current"
          value="$425,000"
          trend={{ direction: 'up', value: '+5.2%' }}
        />
      );
      const trend = screen.getByTestId('stat-card-trend');
      expect(trend).toBeInTheDocument();
      expect(screen.getByTestId('trend-arrow-up')).toBeInTheDocument();
      expect(trend).toHaveTextContent('+5.2%');
    });

    it('shows red down arrow for negative trend', () => {
      render(
        <StatCard
          label="Current"
          value="$425,000"
          trend={{ direction: 'down', value: '-3.1%' }}
        />
      );
      const trend = screen.getByTestId('stat-card-trend');
      expect(screen.getByTestId('trend-arrow-down')).toBeInTheDocument();
      expect(trend).toHaveTextContent('-3.1%');
    });

    it('shows neutral indicator for zero change', () => {
      render(
        <StatCard
          label="Current"
          value="$425,000"
          trend={{ direction: 'neutral', value: '0.0%' }}
        />
      );
      expect(screen.getByTestId('trend-arrow-neutral')).toBeInTheDocument();
    });

    it('hides trend when not provided', () => {
      render(<StatCard label="Current" value="$425,000" />);
      expect(screen.queryByTestId('stat-card-trend')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows skeleton when loading=true', () => {
      render(<StatCard label="Current" value="$425,000" loading={true} />);
      expect(screen.getByTestId('stat-card-loading')).toBeInTheDocument();
    });

    it('hides skeleton when loading=false', () => {
      render(<StatCard label="Current" value="$425,000" loading={false} />);
      expect(screen.queryByTestId('stat-card-loading')).not.toBeInTheDocument();
    });

    it('does not show value when loading', () => {
      render(<StatCard label="Current" value="$425,000" loading={true} />);
      expect(screen.queryByTestId('stat-card-value')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error prop is set', () => {
      render(<StatCard label="Current" value="$425,000" error="Failed to load data" />);
      expect(screen.getByTestId('stat-card-error')).toHaveTextContent('Failed to load data');
    });

    it('shows retry button when onRetry is provided', () => {
      const handleRetry = vi.fn();
      render(
        <StatCard
          label="Current"
          value="$425,000"
          error="Failed to load data"
          onRetry={handleRetry}
        />
      );
      expect(screen.getByTestId('stat-card-retry')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const handleRetry = vi.fn();
      render(
        <StatCard
          label="Current"
          value="$425,000"
          error="Failed to load data"
          onRetry={handleRetry}
        />
      );
      fireEvent.click(screen.getByTestId('stat-card-retry'));
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show retry button when onRetry is not provided', () => {
      render(<StatCard label="Current" value="$425,000" error="Failed to load data" />);
      expect(screen.queryByTestId('stat-card-retry')).not.toBeInTheDocument();
    });

    it('does not show value when in error state', () => {
      render(<StatCard label="Current" value="$425,000" error="Failed to load data" />);
      expect(screen.queryByTestId('stat-card-value')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      render(<StatCard label="Current" value="$425,000" className="custom-class" />);
      expect(screen.getByTestId('stat-card')).toHaveClass('custom-class');
    });

    it('has default background styling', () => {
      render(<StatCard label="Current" value="$425,000" />);
      expect(screen.getByTestId('stat-card')).toHaveClass('bg-gray-50');
    });

    it('has error background styling in error state', () => {
      render(<StatCard label="Current" value="$425,000" error="Error" />);
      expect(screen.getByTestId('stat-card-error')).toHaveClass('bg-red-50');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string value', () => {
      render(<StatCard label="Current" value="" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('');
    });

    it('handles very long values', () => {
      render(<StatCard label="Current" value="$1,234,567,890,123" />);
      expect(screen.getByTestId('stat-card-value')).toHaveTextContent('$1,234,567,890,123');
    });

    it('handles special characters in label', () => {
      render(<StatCard label="YoY Change %" value="5.2%" />);
      expect(screen.getByTestId('stat-card-label')).toHaveTextContent('YoY Change %');
    });
  });
});
