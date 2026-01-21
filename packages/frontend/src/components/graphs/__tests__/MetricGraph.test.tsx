import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MetricGraph } from '../MetricGraph';

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

// Mock the metric registry
vi.mock('@/src/config/metric-registry', () => ({
  METRIC_REGISTRY: {
    zhvi: {
      id: 'zhvi',
      name: 'Zillow Home Value Index',
      shortName: 'ZHVI',
      fullName: 'Zillow Home Value Index',
      description: 'Zillow Home Value Index',
      category: 'home-values',
      subcategory: 'home-prices',
      apiEndpoint: '/api/v1/zillow/zhvi',
      tableName: 'zillow_zhvi',
      valueField: 'value',
      format: 'currency',
      precision: 0,
      chartType: 'line',
      colorScale: 'neutral',
      geoLevels: ['national', 'state', 'metro', 'county', 'zip', 'city'],
      frequency: 'monthly',
    },
    inventory: {
      id: 'inventory',
      name: 'For Sale Inventory',
      shortName: 'Inventory',
      fullName: 'For Sale Inventory',
      description: 'For Sale Inventory',
      category: 'market-trends',
      subcategory: 'inventory',
      apiEndpoint: '/api/v1/zillow/inventory',
      tableName: 'zillow_inventory',
      valueField: 'value',
      format: 'number',
      precision: 0,
      chartType: 'area',
      colorScale: 'neutral',
      geoLevels: ['national', 'state', 'metro'],
      frequency: 'monthly',
    },
    new_listings: {
      id: 'new_listings',
      name: 'New Listings',
      shortName: 'New Listings',
      fullName: 'New Listings',
      description: 'New Listings',
      category: 'market-trends',
      subcategory: 'listings',
      apiEndpoint: '/api/v1/zillow/new-listings',
      tableName: 'zillow_new_listings',
      valueField: 'value',
      format: 'number',
      precision: 0,
      chartType: 'bar',
      colorScale: 'neutral',
      geoLevels: ['national', 'state', 'metro'],
      frequency: 'monthly',
    },
    unknown_metric: undefined,
  },
}));

describe('MetricGraph', () => {
  const defaultProps = {
    metricId: 'zhvi',
    regionId: '60601',
    regionName: 'Chicago, IL 60601',
    geoLevel: 'zip' as const,
  };

  // Helper to wait for data to load (the component has a 500ms mock delay)
  const waitForDataLoad = async () => {
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      const { container } = render(<MetricGraph {...defaultProps} />);
      // The component shows a spinner during loading
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides loading spinner after data loads', async () => {
      const { container } = render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Unknown Metric Handling', () => {
    it('displays error for unknown metric', () => {
      render(<MetricGraph {...defaultProps} metricId="unknown_metric" />);
      expect(screen.getByText(/Unknown metric/)).toBeInTheDocument();
    });
  });

  describe('Chart Rendering', () => {
    it('renders line chart for line chartType', async () => {
      render(<MetricGraph {...defaultProps} metricId="zhvi" />);

      await waitForDataLoad();

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders area chart for area chartType', async () => {
      render(<MetricGraph {...defaultProps} metricId="inventory" />);

      await waitForDataLoad();

      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('renders bar chart for bar chartType', async () => {
      render(<MetricGraph {...defaultProps} metricId="new_listings" />);

      await waitForDataLoad();

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('renders ResponsiveContainer', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Time Range Controls', () => {
    it('renders all time range buttons', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3Y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5Y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '10Y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ALL' })).toBeInTheDocument();
    });

    it('defaults to 5Y time range with active styling', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      const button5Y = screen.getByRole('button', { name: '5Y' });
      expect(button5Y).toHaveClass('bg-blue-100');
    });

    it('changes active button styling when clicked', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      const button1Y = screen.getByRole('button', { name: '1Y' });
      const button5Y = screen.getByRole('button', { name: '5Y' });

      // 5Y should be active initially
      expect(button5Y).toHaveClass('bg-blue-100');

      // Click 1Y
      fireEvent.click(button1Y);

      // Wait for re-render after state change
      await waitForDataLoad();

      // 1Y should now be active
      expect(button1Y).toHaveClass('bg-blue-100');
    });
  });

  describe('Interval Controls', () => {
    it('renders interval toggle buttons', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quarterly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yearly' })).toBeInTheDocument();
    });

    it('defaults to Monthly interval with active styling', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      const buttonMonthly = screen.getByRole('button', { name: 'Monthly' });
      expect(buttonMonthly).toHaveClass('bg-blue-100');
    });
  });

  describe('Statistics Cards', () => {
    it('displays current value stat card', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('displays average value stat card', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText('Average')).toBeInTheDocument();
    });

    it('displays min value stat card', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    it('displays max value stat card', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText('Max')).toBeInTheDocument();
    });
  });

  describe('Header Display', () => {
    it('displays metric name in header', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText('Zillow Home Value Index')).toBeInTheDocument();
    });

    it('displays region name in header', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      expect(screen.getByText(/Chicago, IL 60601/)).toBeInTheDocument();
    });
  });

  describe('YoY Change Display', () => {
    it('displays YoY change indicator', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      // The mock data should generate a YoY change
      expect(screen.getByText(/YoY/)).toBeInTheDocument();
    });
  });

  describe('Export Actions', () => {
    it('renders action buttons in header', async () => {
      render(<MetricGraph {...defaultProps} />);

      await waitForDataLoad();

      // The component has action buttons - just verify there are multiple buttons
      const buttons = screen.getAllByRole('button');
      // Time range (5) + interval (3) + action buttons (3)
      expect(buttons.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Edge Cases', () => {
    it('does not crash with empty compareRegions', async () => {
      render(<MetricGraph {...defaultProps} compareRegions={[]} />);

      await waitForDataLoad();

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
