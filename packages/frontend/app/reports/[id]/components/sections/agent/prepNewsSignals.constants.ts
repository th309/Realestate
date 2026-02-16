import type { LucideIcon } from 'lucide-react';
import { DollarSign, Package, Users } from 'lucide-react';

import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * A news item from report data
 */
export interface NewsItem {
  title: string;
  summary?: string;
  date?: string;
  source?: string;
}

/**
 * A derived market signal
 */
export interface MarketSignal {
  label: string;
  status: 'improving' | 'stable' | 'declining';
  icon: LucideIcon;
  detail: string;
}

/**
 * Helper to safely get a metric value trying common aliases
 */
function getMetric(
  report: ReportInstance,
  metricIds: string[]
): number | null {
  for (const id of metricIds) {
    const value = getMetricWithAliases(report, id);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Get news items from report data
 */
export function getNewsItems(report: ReportInstance): NewsItem[] {
  const newsData =
    report.populated_data?.news ??
    (report as any).news_events;

  if (!Array.isArray(newsData)) return [];

  return newsData
    .filter(
      (item: any) => item && typeof item === 'object' && typeof item.title === 'string'
    )
    .map((item: any) => ({
      title: item.title,
      summary: item.summary || item.description || undefined,
      date: item.date || item.published_at || undefined,
      source: item.source || item.publisher || undefined,
    }));
}

/**
 * Derive market signals from metric data
 */
export function deriveMarketSignals(report: ReportInstance): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Price Momentum
  const yoyChange = getMetric(report, ['home_value_yoy', 'zhvi_yoy', 'price_yoy']);
  if (yoyChange !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (yoyChange > 3) {
      status = 'improving';
      detail = `Prices rising ${yoyChange.toFixed(1)}% YoY — strong appreciation`;
    } else if (yoyChange >= -1) {
      status = 'stable';
      detail = `Prices ${yoyChange >= 0 ? 'up' : 'down'} ${Math.abs(yoyChange).toFixed(1)}% YoY — stable`;
    } else {
      status = 'declining';
      detail = `Prices down ${Math.abs(yoyChange).toFixed(1)}% YoY — correction underway`;
    }

    signals.push({
      label: 'Price Momentum',
      status,
      icon: DollarSign,
      detail,
    });
  }

  // Supply Trend
  const inventory = getMetric(report, ['for_sale_inventory', 'active_listing_count', 'active_listings']);
  const monthsOfSupply = getMetric(report, ['months_of_supply', 'supply_months']);
  if (inventory !== null || monthsOfSupply !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (monthsOfSupply !== null) {
      if (monthsOfSupply > 6) {
        status = 'improving'; // More supply = improving for buyers
        detail = `${monthsOfSupply.toFixed(1)} months of supply — buyer-friendly levels`;
      } else if (monthsOfSupply >= 3) {
        status = 'stable';
        detail = `${monthsOfSupply.toFixed(1)} months of supply — balanced inventory`;
      } else {
        status = 'declining'; // Low supply = declining for buyers
        detail = `${monthsOfSupply.toFixed(1)} months of supply — tight inventory`;
      }
    } else {
      status = 'stable';
      detail = `${inventory} active listings on market`;
    }

    signals.push({
      label: 'Supply Trend',
      status,
      icon: Package,
      detail,
    });
  }

  // Demand Indicators
  const pendingRatio = getMetric(report, ['pending_ratio', 'pending_listing_count']);
  const dom = getMetric(report, ['days_on_market', 'median_dom', 'dom']);
  if (pendingRatio !== null || dom !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (dom !== null) {
      if (dom <= 21) {
        status = 'improving';
        detail = `${Math.round(dom)} days on market — high demand, fast absorption`;
      } else if (dom <= 45) {
        status = 'stable';
        detail = `${Math.round(dom)} days on market — normal demand levels`;
      } else {
        status = 'declining';
        detail = `${Math.round(dom)} days on market — demand softening`;
      }
    } else if (pendingRatio !== null) {
      if (pendingRatio > 0.5) {
        status = 'improving';
        detail = 'High pending-to-active ratio — strong buyer activity';
      } else if (pendingRatio > 0.2) {
        status = 'stable';
        detail = 'Moderate pending-to-active ratio — steady demand';
      } else {
        status = 'declining';
        detail = 'Low pending-to-active ratio — buyers are hesitant';
      }
    } else {
      status = 'stable';
      detail = 'Demand indicators are within normal ranges';
    }

    signals.push({
      label: 'Demand Indicators',
      status,
      icon: Users,
      detail,
    });
  }

  // Seller Sentiment
  const priceCuts = getMetric(report, ['price_reduced_share', 'price_cut_pct']);
  if (priceCuts !== null) {
    let status: 'improving' | 'stable' | 'declining';
    let detail: string;

    if (priceCuts < 10) {
      status = 'improving';
      detail = `Only ${priceCuts.toFixed(0)}% with price cuts — sellers confident`;
    } else if (priceCuts < 25) {
      status = 'stable';
      detail = `${priceCuts.toFixed(0)}% with price cuts — normal adjustment`;
    } else {
      status = 'declining';
      detail = `${priceCuts.toFixed(0)}% with price cuts — sellers losing confidence`;
    }

    signals.push({
      label: 'Seller Sentiment',
      status,
      icon: DollarSign,
      detail,
    });
  }

  return signals;
}

/**
 * Get status color for a signal
 */
export function getStatusColor(status: 'improving' | 'stable' | 'declining'): string {
  switch (status) {
    case 'improving':
      return 'var(--report-success)';
    case 'declining':
      return 'var(--report-error)';
    default:
      return 'var(--report-stone)';
  }
}

/**
 * Get status background color
 */
export function getStatusBgColor(status: 'improving' | 'stable' | 'declining'): string {
  switch (status) {
    case 'improving':
      return 'var(--report-success-bg)';
    case 'declining':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-cream-dark)';
  }
}

/**
 * Format a date string for display
 */
export function formatNewsDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
