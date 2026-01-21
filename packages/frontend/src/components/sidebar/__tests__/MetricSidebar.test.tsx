import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricSidebar } from '../MetricSidebar';

// Mock the Icons
vi.mock('@/src/components/common/Icons', () => ({
  StarIcon: () => <span data-testid="star-icon" />,
  HomeIcon: () => <span data-testid="home-icon" />,
  TrendingIcon: () => <span data-testid="trending-icon" />,
  BuildingIcon: () => <span data-testid="building-icon" />,
  PeopleIcon: () => <span data-testid="people-icon" />,
  ChartIcon: () => <span data-testid="chart-icon" />,
  MoneyIcon: () => <span data-testid="money-icon" />,
  ScoreIcon: () => <span data-testid="score-icon" />,
  ChevronLeftIcon: () => <span data-testid="chevron-left-icon" />,
  ChevronRightIcon: () => <span data-testid="chevron-right-icon" />,
  ChevronIcon: ({ expanded }: { expanded: boolean }) => (
    <span data-testid={expanded ? 'chevron-expanded' : 'chevron-collapsed'} />
  ),
}));

// Mock the metric registry
vi.mock('@/src/config/metric-registry', () => ({
  METRIC_REGISTRY: {
    zhvi: {
      id: 'zhvi',
      name: 'Zillow Home Value Index',
      shortName: 'ZHVI',
      category: 'Home Price & Affordability',
      subcategory: null,
    },
    zori: {
      id: 'zori',
      name: 'Zillow Observed Rent Index',
      shortName: 'ZORI',
      category: 'Rentals',
      subcategory: null,
    },
    affordable_price: {
      id: 'affordable_price',
      name: 'Affordable Price',
      shortName: 'Affordable Price',
      category: 'Home Price & Affordability',
      subcategory: null,
    },
    market_heat: {
      id: 'market_heat',
      name: 'Market Heat Index',
      shortName: 'Market Heat',
      category: 'Market Trends',
      subcategory: 'Velocity',
    },
    zhvf_yoy: {
      id: 'zhvf_yoy',
      name: 'ZHVI YoY Change',
      shortName: 'ZHVI YoY',
      category: 'Home Price & Affordability',
      subcategory: null,
    },
    days_to_pending: {
      id: 'days_to_pending',
      name: 'Days to Pending',
      shortName: 'Days to Pending',
      category: 'Market Trends',
      subcategory: 'Velocity',
    },
    sale_to_list: {
      id: 'sale_to_list',
      name: 'Sale to List Ratio',
      shortName: 'Sale/List',
      category: 'Market Trends',
      subcategory: 'Pricing Dynamics',
    },
    inventory: {
      id: 'inventory',
      name: 'For Sale Inventory',
      shortName: 'Inventory',
      category: 'Market Trends',
      subcategory: 'Supply',
    },
  },
}));

describe('MetricSidebar', () => {
  const defaultProps = {
    selectedMetric: 'zhvi',
    onMetricSelect: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Category Display', () => {
    it('renders all 8 main categories', () => {
      render(<MetricSidebar {...defaultProps} />);

      expect(screen.getByText('Popular Data')).toBeInTheDocument();
      expect(screen.getByText('Home Price & Affordability')).toBeInTheDocument();
      expect(screen.getByText('Market Trends')).toBeInTheDocument();
      expect(screen.getByText('Rentals')).toBeInTheDocument();
      expect(screen.getByText('Demographic')).toBeInTheDocument();
      expect(screen.getByText('Economic Context')).toBeInTheDocument();
      expect(screen.getByText('Investor Metrics')).toBeInTheDocument();
      expect(screen.getByText('PropertyIQ Scores')).toBeInTheDocument();
    });

    it('expands category on click', () => {
      render(<MetricSidebar {...defaultProps} />);

      // Popular is expanded by default
      expect(screen.queryAllByTestId('chevron-expanded')).toHaveLength(1);

      // Click on Home Price category
      fireEvent.click(screen.getByText('Home Price & Affordability'));

      // Now should have 2 expanded categories
      expect(screen.queryAllByTestId('chevron-expanded')).toHaveLength(2);
    });

    it('collapses category on second click', () => {
      render(<MetricSidebar {...defaultProps} />);

      // Popular is expanded by default
      const popularButton = screen.getByText('Popular Data');
      fireEvent.click(popularButton);

      // Should collapse Popular
      expect(screen.queryAllByTestId('chevron-expanded')).toHaveLength(0);
    });

    it('shows NEW badge for PropertyIQ Scores', () => {
      render(<MetricSidebar {...defaultProps} />);

      expect(screen.getByText('NEW')).toBeInTheDocument();
    });
  });

  describe('User Mode Toggle', () => {
    it('shows Homebuyer mode by default', () => {
      render(<MetricSidebar {...defaultProps} />);

      const homebuyerButton = screen.getByText('Homebuyer');
      expect(homebuyerButton).toHaveClass('bg-white');
    });

    it('shows Investor button', () => {
      render(<MetricSidebar {...defaultProps} />);

      expect(screen.getByText('Investor')).toBeInTheDocument();
    });

    it('switches to Investor mode when clicked', () => {
      render(<MetricSidebar {...defaultProps} />);

      const investorButton = screen.getByText('Investor');
      fireEvent.click(investorButton);

      expect(investorButton).toHaveClass('bg-white');
    });

    it('displays homebuyer popular metrics in homebuyer mode', () => {
      render(<MetricSidebar {...defaultProps} />);

      // In homebuyer mode, should show these popular metrics (uses shortName)
      expect(screen.getByText('ZHVI')).toBeInTheDocument();
      expect(screen.getByText('ZORI')).toBeInTheDocument();
    });
  });

  describe('Metric Selection', () => {
    it('calls onMetricSelect when metric is clicked', () => {
      const onMetricSelect = vi.fn();
      render(<MetricSidebar {...defaultProps} onMetricSelect={onMetricSelect} />);

      // Click on a metric in the popular section (uses shortName)
      fireEvent.click(screen.getByText('ZHVI'));

      expect(onMetricSelect).toHaveBeenCalledWith('zhvi');
    });

    it('highlights selected metric', () => {
      const { container } = render(<MetricSidebar {...defaultProps} selectedMetric="zhvi" />);

      // The selected metric should have different styling
      const selectedItem = container.querySelector('.bg-blue-50');
      expect(selectedItem).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('shows only icons when collapsed', () => {
      render(<MetricSidebar {...defaultProps} collapsed={true} />);

      // Should not show category names
      expect(screen.queryByText('Popular Data')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Metrics')).not.toBeInTheDocument();

      // Should show icons
      expect(screen.getByTestId('star-icon')).toBeInTheDocument();
    });

    it('calls onToggleCollapse when collapse button is clicked', () => {
      const onToggleCollapse = vi.fn();
      render(<MetricSidebar {...defaultProps} onToggleCollapse={onToggleCollapse} />);

      // Find and click the collapse button (has chevron icon)
      const collapseButton = screen.getByTestId('chevron-left-icon').closest('button');
      fireEvent.click(collapseButton!);

      expect(onToggleCollapse).toHaveBeenCalled();
    });

    it('shows chevron right icon when collapsed', () => {
      render(<MetricSidebar {...defaultProps} collapsed={true} />);

      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
    });

    it('shows chevron left icon when expanded', () => {
      render(<MetricSidebar {...defaultProps} collapsed={false} />);

      expect(screen.getByTestId('chevron-left-icon')).toBeInTheDocument();
    });
  });

  describe('Sidebar Header', () => {
    it('displays "Data Metrics" title when expanded', () => {
      render(<MetricSidebar {...defaultProps} />);

      expect(screen.getByText('Data Metrics')).toBeInTheDocument();
    });

    it('hides title when collapsed', () => {
      render(<MetricSidebar {...defaultProps} collapsed={true} />);

      expect(screen.queryByText('Data Metrics')).not.toBeInTheDocument();
    });
  });
});
