# PropertyIQ Testing & Monitoring Guide

## Overview

This guide covers three testing/monitoring domains:

| Domain | What | Why | Alert Priority |
|--------|------|-----|----------------|
| **Scoring System** | Score calculations, backtesting, formulas | User decisions worth $100K-$1M+ | 🔴 Critical |
| **Data Cards** | 30 UI cards displaying map data | User-facing — broken = lost trust | 🟠 High |
| **Data Ingest** | ETL pipelines from 10+ sources | Silent failures = stale/wrong data everywhere | 🔴 Critical |

---

# Part 1: Scoring System Tests

(See PropertyIQ-Scoring-Implementation-Guide.md, Section 10)

---

# Part 2: Data Card Testing & Monitoring

## 2.1 Data Card Inventory

| # | Card Name | Data Source | Update Frequency | Critical? |
|---|-----------|-------------|------------------|-----------|
| 1 | Median Home Value | `zillow_zhvi` | Monthly | ✅ Yes |
| 2 | Price Change YoY | `zillow_zhvi` | Monthly | ✅ Yes |
| 3 | Price Change 5Y | `zillow_zhvi` | Monthly | ✅ Yes |
| 4 | Median Rent | `zillow_zori` | Monthly | ✅ Yes |
| 5 | Rent Change YoY | `zillow_zori` | Monthly | ✅ Yes |
| 6 | Days on Market | `zillow_dom` | Monthly | ✅ Yes |
| 7 | Inventory | `zillow_inventory` | Monthly | ✅ Yes |
| 8 | List Price | `zillow_list_price` | Monthly | ✅ Yes |
| 9 | Price Cut % | `zillow_price_cuts` | Monthly | ⚠️ Medium |
| 10 | Sale-to-List Ratio | `zillow_sale_list` | Monthly | ⚠️ Medium |
| 11 | Pending Ratio | `zillow_pending` | Monthly | ✅ Yes |
| 12 | New Listings | `zillow_new_listings` | Monthly | ⚠️ Medium |
| 13 | Population | `census_population` | Yearly | ✅ Yes |
| 14 | Population Growth | `census_population` | Yearly | ✅ Yes |
| 15 | Median Income | `census_income` | Yearly | ✅ Yes |
| 16 | Unemployment Rate | `bls_unemployment` | Monthly | ✅ Yes |
| 17 | Employment Growth | `bls_employment` | Monthly | ⚠️ Medium |
| 18 | Poverty Rate | `census_poverty` | Yearly | ⚠️ Medium |
| 19 | Education Level | `census_education` | Yearly | ⚠️ Medium |
| 20 | Homeownership Rate | `census_housing` | Yearly | ⚠️ Medium |
| 21 | Vacancy Rate | `census_housing` | Yearly | ⚠️ Medium |
| 22 | Median Age | `census_demographics` | Yearly | ⚠️ Low |
| 23 | Crime Index | `fbi_crime` | Yearly | ⚠️ Medium |
| 24 | School Rating | `greatschools` | Yearly | ⚠️ Medium |
| 25 | Walk Score | `walkscore_api` | Quarterly | ⚠️ Low |
| 26 | Transit Score | `walkscore_api` | Quarterly | ⚠️ Low |
| 27 | Air Quality | `epa_aqi` | Daily | ⚠️ Low |
| 28 | Natural Disaster Risk | `fema_risk` | Yearly | ⚠️ Medium |
| 29 | Property Tax Rate | `census_taxes` | Yearly | ⚠️ Medium |
| 30 | Cap Rate | `calculated` | Monthly | ✅ Yes |

## 2.2 Data Card Test Strategy

### Unit Tests: Card Component Rendering

```typescript
// tests/unit/data-cards/DataCard.test.tsx

import { render, screen } from '@testing-library/react';
import { MedianHomeValueCard } from '@/components/data-cards/MedianHomeValueCard';

describe('MedianHomeValueCard', () => {
  
  // Happy Path
  describe('with valid data', () => {
    it('displays formatted value correctly', () => {
      const data = { zhvi: 425000, zhvi_yoy: 0.052 };
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('$425,000')).toBeInTheDocument();
      expect(screen.getByText('+5.2%')).toBeInTheDocument();
    });
    
    it('shows green trend arrow for positive change', () => {
      const data = { zhvi: 425000, zhvi_yoy: 0.052 };
      render(<MedianHomeValueCard data={data} />);
      
      const arrow = screen.getByTestId('trend-arrow');
      expect(arrow).toHaveClass('text-green-500');
      expect(arrow).toHaveAttribute('aria-label', 'increasing');
    });
    
    it('shows red trend arrow for negative change', () => {
      const data = { zhvi: 425000, zhvi_yoy: -0.032 };
      render(<MedianHomeValueCard data={data} />);
      
      const arrow = screen.getByTestId('trend-arrow');
      expect(arrow).toHaveClass('text-red-500');
      expect(arrow).toHaveAttribute('aria-label', 'decreasing');
    });
  });
  
  // Null/Missing Data
  describe('with missing data', () => {
    it('displays "N/A" when value is null', () => {
      const data = { zhvi: null, zhvi_yoy: null };
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.queryByTestId('trend-arrow')).not.toBeInTheDocument();
    });
    
    it('displays value but no trend when only YoY is null', () => {
      const data = { zhvi: 425000, zhvi_yoy: null };
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('$425,000')).toBeInTheDocument();
      expect(screen.queryByTestId('trend-arrow')).not.toBeInTheDocument();
    });
  });
  
  // Edge Cases
  describe('edge cases', () => {
    it('handles zero value', () => {
      const data = { zhvi: 0, zhvi_yoy: 0 };
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
    
    it('handles very large values', () => {
      const data = { zhvi: 15000000, zhvi_yoy: 0.15 };
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('$15.0M')).toBeInTheDocument();
    });
    
    it('handles extreme percentage changes', () => {
      const data = { zhvi: 425000, zhvi_yoy: 2.5 }; // 250% increase
      render(<MedianHomeValueCard data={data} />);
      
      expect(screen.getByText('+250.0%')).toBeInTheDocument();
    });
  });
  
  // Loading State
  describe('loading state', () => {
    it('shows skeleton when loading', () => {
      render(<MedianHomeValueCard data={null} loading={true} />);
      
      expect(screen.getByTestId('card-skeleton')).toBeInTheDocument();
    });
  });
  
  // Error State
  describe('error state', () => {
    it('shows error message when data fetch failed', () => {
      render(<MedianHomeValueCard data={null} error="Failed to load" />);
      
      expect(screen.getByText('Unable to load data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });
});
```

### Integration Tests: Data Card + API

```typescript
// tests/integration/data-cards/DataCardIntegration.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { DataCardSidebar } from '@/components/sidebar/DataCardSidebar';

const server = setupServer(
  rest.get('/api/geography/:id/metrics', (req, res, ctx) => {
    return res(ctx.json({
      geography_id: req.params.id,
      zhvi: 425000,
      zhvi_yoy: 0.052,
      zori: 2100,
      zori_yoy: 0.038,
      median_days_on_market: 28,
      // ... all 30 metrics
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DataCardSidebar Integration', () => {
  
  it('loads and displays all 30 data cards for a geography', async () => {
    render(<DataCardSidebar geographyId="60601" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Verify all critical cards are present
    expect(screen.getByTestId('card-median-home-value')).toBeInTheDocument();
    expect(screen.getByTestId('card-median-rent')).toBeInTheDocument();
    expect(screen.getByTestId('card-days-on-market')).toBeInTheDocument();
    expect(screen.getByTestId('card-population')).toBeInTheDocument();
    expect(screen.getByTestId('card-unemployment')).toBeInTheDocument();
    
    // Verify values are displayed
    expect(screen.getByText('$425,000')).toBeInTheDocument();
    expect(screen.getByText('$2,100')).toBeInTheDocument();
    expect(screen.getByText('28 days')).toBeInTheDocument();
  });
  
  it('handles API error gracefully', async () => {
    server.use(
      rest.get('/api/geography/:id/metrics', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );
    
    render(<DataCardSidebar geographyId="60601" />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
  
  it('updates cards when geography changes', async () => {
    const { rerender } = render(<DataCardSidebar geographyId="60601" />);
    
    await waitFor(() => {
      expect(screen.getByText('$425,000')).toBeInTheDocument();
    });
    
    // Change to different geography
    server.use(
      rest.get('/api/geography/:id/metrics', (req, res, ctx) => {
        if (req.params.id === '90210') {
          return res(ctx.json({
            geography_id: '90210',
            zhvi: 2850000,
            zhvi_yoy: 0.028,
            // ...
          }));
        }
      })
    );
    
    rerender(<DataCardSidebar geographyId="90210" />);
    
    await waitFor(() => {
      expect(screen.getByText('$2.9M')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests: Full User Workflow

```typescript
// tests/e2e/data-cards/data-cards.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Data Cards on Map Page', () => {
  
  test('displays all data cards when user selects a ZIP code', async ({ page }) => {
    await page.goto('/map');
    
    // Search for a ZIP code
    await page.fill('[data-testid="geography-search"]', '60601');
    await page.click('[data-testid="search-result-60601"]');
    
    // Wait for sidebar to load
    await expect(page.locator('[data-testid="data-card-sidebar"]')).toBeVisible();
    
    // Verify all 30 cards are rendered
    const cards = await page.locator('[data-testid^="card-"]').count();
    expect(cards).toBe(30);
    
    // Verify specific cards have data (not N/A for this known-good ZIP)
    await expect(page.locator('[data-testid="card-median-home-value"]')).not.toContainText('N/A');
    await expect(page.locator('[data-testid="card-median-rent"]')).not.toContainText('N/A');
    await expect(page.locator('[data-testid="card-population"]')).not.toContainText('N/A');
  });
  
  test('cards update when switching between geographies', async ({ page }) => {
    await page.goto('/map');
    
    // Select first ZIP
    await page.fill('[data-testid="geography-search"]', '60601');
    await page.click('[data-testid="search-result-60601"]');
    
    const firstValue = await page.locator('[data-testid="card-median-home-value"] [data-testid="card-value"]').textContent();
    
    // Select different ZIP
    await page.fill('[data-testid="geography-search"]', '90210');
    await page.click('[data-testid="search-result-90210"]');
    
    // Wait for new data
    await page.waitForResponse(resp => resp.url().includes('/api/geography/90210'));
    
    const secondValue = await page.locator('[data-testid="card-median-home-value"] [data-testid="card-value"]').textContent();
    
    // Values should be different (60601 Chicago vs 90210 Beverly Hills)
    expect(firstValue).not.toBe(secondValue);
  });
  
  test('handles geography with missing data gracefully', async ({ page }) => {
    await page.goto('/map');
    
    // Select a rural ZIP known to have sparse data
    await page.fill('[data-testid="geography-search"]', '59001'); // Rural Montana
    await page.click('[data-testid="search-result-59001"]');
    
    await expect(page.locator('[data-testid="data-card-sidebar"]')).toBeVisible();
    
    // Some cards should show N/A, but no errors
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    
    // Critical cards should still have data (inherited or direct)
    await expect(page.locator('[data-testid="card-population"]')).not.toContainText('Error');
  });
});
```

## 2.3 Data Card Health Monitoring

### Automated Health Check Endpoint

```typescript
// src/app/api/health/data-cards/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

interface CardHealthCheck {
  cardName: string;
  tableName: string;
  column: string;
  expectedFreshness: number; // days
  critical: boolean;
}

const CARD_HEALTH_CHECKS: CardHealthCheck[] = [
  { cardName: 'Median Home Value', tableName: 'zillow_zhvi', column: 'zhvi', expectedFreshness: 45, critical: true },
  { cardName: 'Median Rent', tableName: 'zillow_zori', column: 'zori', expectedFreshness: 45, critical: true },
  { cardName: 'Days on Market', tableName: 'zillow_market_metrics', column: 'median_dom', expectedFreshness: 45, critical: true },
  { cardName: 'Population', tableName: 'census_population', column: 'population', expectedFreshness: 400, critical: true },
  { cardName: 'Unemployment', tableName: 'bls_unemployment', column: 'unemployment_rate', expectedFreshness: 45, critical: true },
  // ... all 30 cards
];

export async function GET() {
  const results: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      cardName: string;
      status: 'ok' | 'stale' | 'empty' | 'error';
      latestDate: string | null;
      recordCount: number;
      coverage: number; // % of geographies with data
      message?: string;
    }[];
    summary: {
      total: number;
      healthy: number;
      stale: number;
      empty: number;
      errors: number;
    };
  } = {
    status: 'healthy',
    checks: [],
    summary: { total: 0, healthy: 0, stale: 0, empty: 0, errors: 0 },
  };
  
  for (const check of CARD_HEALTH_CHECKS) {
    try {
      // Get latest data date
      const latestResult = await db.query(`
        SELECT MAX(data_date) as latest_date, COUNT(*) as record_count
        FROM ${check.tableName}
        WHERE ${check.column} IS NOT NULL
      `);
      
      const latestDate = latestResult.rows[0]?.latest_date;
      const recordCount = parseInt(latestResult.rows[0]?.record_count || '0');
      
      // Get coverage (% of ZIPs with data)
      const coverageResult = await db.query(`
        SELECT 
          COUNT(DISTINCT geography_id) as with_data,
          (SELECT COUNT(*) FROM geographies WHERE geography_type = 'zip') as total_zips
        FROM ${check.tableName}
        WHERE ${check.column} IS NOT NULL
          AND data_date = $1
      `, [latestDate]);
      
      const coverage = coverageResult.rows[0]?.total_zips > 0
        ? (coverageResult.rows[0].with_data / coverageResult.rows[0].total_zips) * 100
        : 0;
      
      // Determine status
      let status: 'ok' | 'stale' | 'empty' | 'error' = 'ok';
      let message: string | undefined;
      
      if (recordCount === 0) {
        status = 'empty';
        message = 'No data found';
      } else if (latestDate) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceUpdate > check.expectedFreshness) {
          status = 'stale';
          message = `Data is ${daysSinceUpdate} days old (expected < ${check.expectedFreshness})`;
        }
      }
      
      results.checks.push({
        cardName: check.cardName,
        status,
        latestDate,
        recordCount,
        coverage: Math.round(coverage * 10) / 10,
        message,
      });
      
      results.summary.total++;
      if (status === 'ok') results.summary.healthy++;
      else if (status === 'stale') results.summary.stale++;
      else if (status === 'empty') results.summary.empty++;
      
    } catch (error) {
      results.checks.push({
        cardName: check.cardName,
        status: 'error',
        latestDate: null,
        recordCount: 0,
        coverage: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      results.summary.errors++;
    }
  }
  
  // Determine overall status
  const criticalIssues = results.checks.filter(
    c => (c.status !== 'ok') && CARD_HEALTH_CHECKS.find(h => h.cardName === c.cardName)?.critical
  );
  
  if (criticalIssues.length > 0) {
    results.status = results.summary.errors > 0 ? 'unhealthy' : 'degraded';
  }
  
  return NextResponse.json(results);
}
```

### Monitoring Dashboard Component

```typescript
// src/app/admin/monitoring/data-cards/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface CardHealth {
  cardName: string;
  status: 'ok' | 'stale' | 'empty' | 'error';
  latestDate: string | null;
  recordCount: number;
  coverage: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: CardHealth[];
  summary: {
    total: number;
    healthy: number;
    stale: number;
    empty: number;
    errors: number;
  };
}

export default function DataCardMonitoringPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health/data-cards');
      const data = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to fetch health:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'stale': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'empty': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      healthy: 'default',
      degraded: 'secondary',
      unhealthy: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Data Card Health Monitor</h1>
          <p className="text-gray-500">
            {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
          </p>
        </div>
        <button 
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {health && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Overall Status</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(health.status)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Healthy</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-green-600">{health.summary.healthy}</span>
                <span className="text-gray-500">/{health.summary.total}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Stale</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-yellow-600">{health.summary.stale}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Empty</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-orange-600">{health.summary.empty}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-red-600">{health.summary.errors}</span>
              </CardContent>
            </Card>
          </div>
          
          {/* Individual Card Status Table */}
          <Card>
            <CardHeader>
              <CardTitle>Data Card Status</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Card</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Latest Data</th>
                    <th className="text-right py-2">Records</th>
                    <th className="text-right py-2">Coverage</th>
                    <th className="text-left py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {health.checks.map((check) => (
                    <tr key={check.cardName} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{check.cardName}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(check.status)}
                          <span className="capitalize">{check.status}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        {check.latestDate 
                          ? new Date(check.latestDate).toLocaleDateString()
                          : 'N/A'
                        }
                      </td>
                      <td className="py-2 text-right">{check.recordCount.toLocaleString()}</td>
                      <td className="py-2 text-right">{check.coverage}%</td>
                      <td className="py-2 text-sm text-gray-500">{check.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

### Scheduled Health Check (Cron)

```yaml
# .github/workflows/data-card-health-check.yml
name: Data Card Health Check

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    
    steps:
      - name: Check Data Card Health
        id: health
        run: |
          RESPONSE=$(curl -s "${{ secrets.API_URL }}/api/health/data-cards")
          STATUS=$(echo $RESPONSE | jq -r '.status')
          echo "status=$STATUS" >> $GITHUB_OUTPUT
          echo "response=$RESPONSE" >> $GITHUB_OUTPUT
      
      - name: Send Alert if Unhealthy
        if: steps.health.outputs.status != 'healthy'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          SUMMARY=$(echo '${{ steps.health.outputs.response }}' | jq '.summary')
          FAILED=$(echo '${{ steps.health.outputs.response }}' | jq '[.checks[] | select(.status != "ok")] | map(.cardName) | join(", ")')
          
          curl -X POST $SLACK_WEBHOOK_URL \
            -H 'Content-type: application/json' \
            -d "{
              \"attachments\": [{
                \"color\": \"danger\",
                \"title\": \"🔴 Data Card Health Alert\",
                \"text\": \"Status: ${{ steps.health.outputs.status }}\",
                \"fields\": [
                  {\"title\": \"Summary\", \"value\": \"$SUMMARY\", \"short\": false},
                  {\"title\": \"Affected Cards\", \"value\": $FAILED, \"short\": false}
                ]
              }]
            }"
```

---

# Part 3: Data Ingest Testing & Monitoring

## 3.1 Data Source Inventory

| Source | Type | Update Frequency | Method | Critical? |
|--------|------|------------------|--------|-----------|
| Zillow ZHVI | File | Monthly | S3 Download | ✅ Yes |
| Zillow ZORI | File | Monthly | S3 Download | ✅ Yes |
| Zillow Market Metrics | File | Monthly | S3 Download | ✅ Yes |
| Census ACS | API | Yearly | API Pull | ✅ Yes |
| Census Population | API | Yearly | API Pull | ✅ Yes |
| BLS Unemployment | API | Monthly | API Pull | ✅ Yes |
| BLS Employment | API | Monthly | API Pull | ⚠️ Medium |
| FBI Crime | File | Yearly | Download | ⚠️ Medium |
| GreatSchools | API | Quarterly | API Pull | ⚠️ Medium |
| WalkScore | API | Quarterly | API Pull | ⚠️ Low |
| EPA Air Quality | API | Daily | API Pull | ⚠️ Low |
| FEMA Risk | File | Yearly | Download | ⚠️ Medium |

## 3.2 Data Ingest Test Strategy

### Unit Tests: Data Transformations

```python
# tests/unit/ingest/test_zillow_transform.py

import pytest
import pandas as pd
from datetime import date
from ingest.transforms.zillow import (
    parse_zillow_csv,
    normalize_geography_ids,
    pivot_time_series,
    validate_zillow_data,
)

class TestZillowTransform:
    
    def test_parse_zillow_csv_happy_path(self):
        """Valid Zillow CSV should parse correctly."""
        csv_content = """RegionID,RegionName,RegionType,StateName,2024-01-31,2024-02-29,2024-03-31
        12345,60601,zip,IL,425000,428000,432000
        12346,60602,zip,IL,380000,382000,385000
        """
        
        df = parse_zillow_csv(csv_content)
        
        assert len(df) == 6  # 2 ZIPs × 3 months
        assert 'geography_id' in df.columns
        assert 'data_date' in df.columns
        assert 'value' in df.columns
        
    def test_parse_zillow_csv_handles_missing_values(self):
        """Missing values should become NaN, not cause errors."""
        csv_content = """RegionID,RegionName,RegionType,StateName,2024-01-31,2024-02-29,2024-03-31
        12345,60601,zip,IL,425000,,432000
        12346,60602,zip,IL,,,385000
        """
        
        df = parse_zillow_csv(csv_content)
        
        assert df[df['geography_id'] == '60601']['value'].isna().sum() == 1
        assert df[df['geography_id'] == '60602']['value'].isna().sum() == 2
        
    def test_normalize_geography_ids_pads_zip_codes(self):
        """ZIP codes should be zero-padded to 5 digits."""
        df = pd.DataFrame({
            'geography_id': ['1234', '60601', '123'],
            'value': [100, 200, 300]
        })
        
        result = normalize_geography_ids(df, 'zip')
        
        assert result['geography_id'].tolist() == ['01234', '60601', '00123']
        
    def test_validate_zillow_data_catches_invalid_values(self):
        """Validation should catch negative prices and unrealistic values."""
        df = pd.DataFrame({
            'geography_id': ['60601', '60602', '60603'],
            'data_date': [date(2024, 1, 31)] * 3,
            'value': [-100, 1000000000, 425000]  # Negative, too high, valid
        })
        
        errors = validate_zillow_data(df, metric='zhvi')
        
        assert len(errors) == 2
        assert any('negative' in e.lower() for e in errors)
        assert any('unrealistic' in e.lower() for e in errors)
```

### Integration Tests: Full Pipeline

```python
# tests/integration/ingest/test_zillow_pipeline.py

import pytest
from datetime import date
from unittest.mock import patch, MagicMock
from ingest.pipelines.zillow import ZillowIngestPipeline
from tests.fixtures.zillow import SAMPLE_ZHVI_CSV

class TestZillowPipeline:
    
    @pytest.fixture
    def pipeline(self, test_db):
        return ZillowIngestPipeline(
            db_connection=test_db,
            source_bucket='test-bucket',
        )
    
    @patch('ingest.pipelines.zillow.download_from_s3')
    def test_full_pipeline_success(self, mock_download, pipeline, test_db):
        """Full pipeline should download, transform, validate, and load data."""
        mock_download.return_value = SAMPLE_ZHVI_CSV
        
        result = pipeline.run(
            metric='zhvi',
            data_date=date(2024, 3, 31)
        )
        
        assert result.status == 'success'
        assert result.records_processed > 0
        assert result.records_loaded > 0
        assert result.errors == []
        
        # Verify data in database
        count = test_db.execute(
            "SELECT COUNT(*) FROM zillow_zhvi WHERE data_date = '2024-03-31'"
        ).fetchone()[0]
        assert count == result.records_loaded
        
    @patch('ingest.pipelines.zillow.download_from_s3')
    def test_pipeline_handles_download_failure(self, mock_download, pipeline):
        """Pipeline should handle S3 download failures gracefully."""
        mock_download.side_effect = Exception("S3 connection timeout")
        
        result = pipeline.run(metric='zhvi', data_date=date(2024, 3, 31))
        
        assert result.status == 'failed'
        assert 'S3 connection timeout' in result.error_message
        assert result.records_loaded == 0
        
    @patch('ingest.pipelines.zillow.download_from_s3')
    def test_pipeline_handles_corrupt_csv(self, mock_download, pipeline):
        """Pipeline should handle malformed CSV files."""
        mock_download.return_value = "not,a,valid,csv\n\x00\x01\x02"
        
        result = pipeline.run(metric='zhvi', data_date=date(2024, 3, 31))
        
        assert result.status == 'failed'
        assert 'parse' in result.error_message.lower() or 'invalid' in result.error_message.lower()
        
    @patch('ingest.pipelines.zillow.download_from_s3')
    def test_pipeline_partial_failure_still_loads_valid_data(self, mock_download, pipeline):
        """Pipeline should load valid rows even if some rows have errors."""
        # CSV with some invalid rows
        csv_with_errors = """RegionID,RegionName,RegionType,StateName,2024-03-31
        12345,60601,zip,IL,425000
        12346,60602,zip,IL,-999
        12347,60603,zip,IL,430000
        """
        mock_download.return_value = csv_with_errors
        
        result = pipeline.run(metric='zhvi', data_date=date(2024, 3, 31))
        
        assert result.status == 'partial'
        assert result.records_loaded == 2  # Only valid rows
        assert result.records_rejected == 1
        assert len(result.errors) == 1
```

### Monitoring Tests: Health Checks

```python
# tests/unit/ingest/test_source_health.py

import pytest
from datetime import datetime, timedelta
from ingest.monitoring.source_health import (
    check_source_availability,
    check_source_freshness,
    check_source_schema,
)

class TestSourceHealth:
    
    def test_check_zillow_s3_availability(self):
        """Zillow S3 bucket should be accessible."""
        result = check_source_availability('zillow_s3')
        
        assert result.available == True
        assert result.response_time_ms < 5000
        
    def test_check_census_api_availability(self):
        """Census API should be accessible."""
        result = check_source_availability('census_api')
        
        assert result.available == True
        assert result.response_time_ms < 10000
        
    def test_check_source_freshness_zillow(self, mock_s3):
        """Zillow data should be updated within expected timeframe."""
        mock_s3.return_value = {'LastModified': datetime.now() - timedelta(days=5)}
        
        result = check_source_freshness('zillow_zhvi', expected_days=45)
        
        assert result.fresh == True
        assert result.days_since_update == 5
        
    def test_check_source_freshness_stale(self, mock_s3):
        """Stale data should be flagged."""
        mock_s3.return_value = {'LastModified': datetime.now() - timedelta(days=60)}
        
        result = check_source_freshness('zillow_zhvi', expected_days=45)
        
        assert result.fresh == False
        assert result.days_since_update == 60
        
    def test_check_source_schema_changes(self, mock_s3):
        """Schema changes should be detected."""
        # Simulate Zillow adding a new column
        mock_s3.return_value = "RegionID,RegionName,RegionType,StateName,NewColumn,2024-03-31\n"
        
        result = check_source_schema('zillow_zhvi')
        
        assert result.schema_changed == True
        assert 'NewColumn' in result.new_columns
```

## 3.3 Data Ingest Monitoring System

### Pipeline Run Tracking

```sql
-- Track all pipeline runs
CREATE TABLE data_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pipeline identification
  pipeline_name VARCHAR(50) NOT NULL,  -- 'zillow_zhvi', 'census_population', etc.
  source_name VARCHAR(50) NOT NULL,    -- 'zillow_s3', 'census_api', etc.
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),
  
  -- Status
  status VARCHAR(20) NOT NULL,  -- 'running', 'success', 'partial', 'failed'
  
  -- Metrics
  records_processed INTEGER DEFAULT 0,
  records_loaded INTEGER DEFAULT 0,
  records_rejected INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  
  -- Data date being loaded
  data_date DATE,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- File/source info
  source_file_path TEXT,
  source_file_size_bytes BIGINT,
  source_last_modified TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_name_date ON data_pipeline_runs(pipeline_name, started_at DESC);
CREATE INDEX idx_pipeline_runs_status ON data_pipeline_runs(status, started_at DESC);

-- Track data source health
CREATE TABLE data_source_health (
  id SERIAL PRIMARY KEY,
  
  source_name VARCHAR(50) NOT NULL,
  check_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Availability
  available BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  
  -- Freshness
  latest_data_date DATE,
  days_since_update INTEGER,
  expected_freshness_days INTEGER,
  is_fresh BOOLEAN,
  
  -- Schema
  schema_hash VARCHAR(64),
  schema_changed BOOLEAN DEFAULT FALSE,
  schema_diff JSONB,
  
  UNIQUE(source_name, check_time)
);

CREATE INDEX idx_source_health_name ON data_source_health(source_name, check_time DESC);

-- Alerting rules
CREATE TABLE data_alert_rules (
  id SERIAL PRIMARY KEY,
  
  rule_name VARCHAR(100) NOT NULL,
  source_name VARCHAR(50),  -- NULL = applies to all sources
  pipeline_name VARCHAR(50),  -- NULL = applies to all pipelines
  
  -- Conditions (JSONB for flexibility)
  condition_type VARCHAR(20) NOT NULL,  -- 'freshness', 'availability', 'failure', 'schema'
  condition_params JSONB NOT NULL,
  
  -- Alert settings
  severity VARCHAR(10) NOT NULL,  -- 'critical', 'warning', 'info'
  notification_channels TEXT[] NOT NULL,  -- ['slack', 'email', 'pagerduty']
  
  enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active alerts
CREATE TABLE data_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_id INTEGER REFERENCES data_alert_rules(id),
  source_name VARCHAR(50),
  pipeline_name VARCHAR(50),
  
  -- Alert details
  severity VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  
  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'open',  -- 'open', 'acknowledged', 'resolved'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_alerts_status ON data_alerts(status, created_at DESC);
```

### Monitoring Service

```python
# ingest/monitoring/service.py

import asyncio
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class AlertSeverity(Enum):
    CRITICAL = 'critical'
    WARNING = 'warning'
    INFO = 'info'

@dataclass
class SourceHealthResult:
    source_name: str
    available: bool
    response_time_ms: int
    fresh: bool
    days_since_update: int
    schema_changed: bool
    error: Optional[str] = None

@dataclass
class AlertRule:
    id: int
    rule_name: str
    source_name: Optional[str]
    pipeline_name: Optional[str]
    condition_type: str
    condition_params: dict
    severity: AlertSeverity
    notification_channels: List[str]

class DataIngestMonitor:
    
    def __init__(self, db, notification_service):
        self.db = db
        self.notifications = notification_service
        
    async def run_health_checks(self) -> List[SourceHealthResult]:
        """Run health checks on all data sources."""
        
        sources = [
            ('zillow_s3', self._check_zillow_s3),
            ('census_api', self._check_census_api),
            ('bls_api', self._check_bls_api),
            # ... all sources
        ]
        
        results = []
        for source_name, check_func in sources:
            try:
                result = await check_func()
                results.append(result)
                await self._save_health_result(result)
            except Exception as e:
                results.append(SourceHealthResult(
                    source_name=source_name,
                    available=False,
                    response_time_ms=0,
                    fresh=False,
                    days_since_update=-1,
                    schema_changed=False,
                    error=str(e)
                ))
        
        # Check for alerts
        await self._evaluate_alerts(results)
        
        return results
    
    async def _check_zillow_s3(self) -> SourceHealthResult:
        """Check Zillow S3 source health."""
        import boto3
        from time import time
        
        s3 = boto3.client('s3')
        bucket = 'zillow-research-data'
        
        # Check availability
        start = time()
        try:
            response = s3.head_bucket(Bucket=bucket)
            available = True
            response_time_ms = int((time() - start) * 1000)
        except Exception as e:
            return SourceHealthResult(
                source_name='zillow_s3',
                available=False,
                response_time_ms=0,
                fresh=False,
                days_since_update=-1,
                schema_changed=False,
                error=str(e)
            )
        
        # Check freshness (look at latest file)
        objects = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='zhvi/',
            MaxKeys=1
        )
        
        if objects.get('Contents'):
            last_modified = objects['Contents'][0]['LastModified']
            days_since = (datetime.now(last_modified.tzinfo) - last_modified).days
            fresh = days_since <= 45
        else:
            days_since = -1
            fresh = False
        
        # Check schema (download header row)
        obj = s3.get_object(Bucket=bucket, Key='zhvi/zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv', Range='bytes=0-1000')
        header = obj['Body'].read().decode('utf-8').split('\n')[0]
        current_schema_hash = hashlib.md5(header.encode()).hexdigest()
        
        previous_hash = await self.db.fetchval(
            "SELECT schema_hash FROM data_source_health WHERE source_name = 'zillow_s3' ORDER BY check_time DESC LIMIT 1"
        )
        schema_changed = previous_hash is not None and previous_hash != current_schema_hash
        
        return SourceHealthResult(
            source_name='zillow_s3',
            available=available,
            response_time_ms=response_time_ms,
            fresh=fresh,
            days_since_update=days_since,
            schema_changed=schema_changed,
        )
    
    async def _evaluate_alerts(self, results: List[SourceHealthResult]):
        """Evaluate alert rules against health check results."""
        
        rules = await self._get_active_rules()
        
        for result in results:
            for rule in rules:
                # Skip if rule doesn't apply to this source
                if rule.source_name and rule.source_name != result.source_name:
                    continue
                
                should_alert = False
                message = ""
                
                if rule.condition_type == 'availability' and not result.available:
                    should_alert = True
                    message = f"Data source {result.source_name} is unavailable: {result.error}"
                    
                elif rule.condition_type == 'freshness' and not result.fresh:
                    threshold = rule.condition_params.get('max_days', 45)
                    if result.days_since_update > threshold:
                        should_alert = True
                        message = f"Data source {result.source_name} is stale: {result.days_since_update} days since last update (threshold: {threshold})"
                        
                elif rule.condition_type == 'schema' and result.schema_changed:
                    should_alert = True
                    message = f"Data source {result.source_name} schema has changed - manual review required"
                
                if should_alert:
                    await self._create_alert(rule, result, message)
    
    async def _create_alert(self, rule: AlertRule, result: SourceHealthResult, message: str):
        """Create an alert and send notifications."""
        
        # Check if alert already exists (dedupe)
        existing = await self.db.fetchval("""
            SELECT id FROM data_alerts 
            WHERE rule_id = $1 AND source_name = $2 AND status = 'open'
        """, rule.id, result.source_name)
        
        if existing:
            return  # Don't create duplicate alerts
        
        # Create alert
        alert_id = await self.db.fetchval("""
            INSERT INTO data_alerts (rule_id, source_name, severity, title, message, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        """, rule.id, result.source_name, rule.severity.value, 
             f"[{rule.severity.value.upper()}] {result.source_name}", 
             message, 
             {'health_result': result.__dict__})
        
        # Send notifications
        for channel in rule.notification_channels:
            await self.notifications.send(
                channel=channel,
                severity=rule.severity,
                title=f"[{rule.severity.value.upper()}] Data Source Alert: {result.source_name}",
                message=message,
                details=result.__dict__
            )
    
    async def check_pipeline_health(self):
        """Check for pipeline failures in recent runs."""
        
        # Get recent failures
        failures = await self.db.fetch("""
            SELECT 
                pipeline_name,
                source_name,
                status,
                error_message,
                started_at
            FROM data_pipeline_runs
            WHERE started_at > NOW() - INTERVAL '24 hours'
              AND status IN ('failed', 'partial')
            ORDER BY started_at DESC
        """)
        
        for failure in failures:
            # Check if alert already exists
            existing = await self.db.fetchval("""
                SELECT id FROM data_alerts 
                WHERE pipeline_name = $1 
                  AND created_at > NOW() - INTERVAL '1 hour'
                  AND status = 'open'
            """, failure['pipeline_name'])
            
            if not existing:
                await self.db.execute("""
                    INSERT INTO data_alerts (
                        pipeline_name, source_name, severity, title, message, details
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                """, 
                    failure['pipeline_name'],
                    failure['source_name'],
                    'critical' if failure['status'] == 'failed' else 'warning',
                    f"Pipeline {failure['status']}: {failure['pipeline_name']}",
                    failure['error_message'] or f"Pipeline {failure['pipeline_name']} {failure['status']}",
                    {'run_details': dict(failure)}
                )
                
                # Send notification
                await self.notifications.send(
                    channel='slack',
                    severity=AlertSeverity.CRITICAL if failure['status'] == 'failed' else AlertSeverity.WARNING,
                    title=f"Pipeline {failure['status'].upper()}: {failure['pipeline_name']}",
                    message=failure['error_message'],
                )
```

### Admin Dashboard: Data Ingest Monitoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN → DATA INGEST MONITORING                                             │
│                                                                             │
│  [Tabs: Source Health | Pipeline Runs | Alerts | Configuration]             │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  SOURCE HEALTH                                                              │
│                                                                             │
│  ┌─ Overall Status ───────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  🟢 All Systems Operational                    Last Check: 2 min ago  │ │
│  │                                                                        │ │
│  │  Sources: 12/12 Available | 11/12 Fresh | 0 Schema Changes            │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Source Status ────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Source           Available  Response  Fresh  Last Update  Schema     │ │
│  │  ─────────────────────────────────────────────────────────────────    │ │
│  │  Zillow S3        🟢 Yes     245ms     ✅     3 days ago   ✅ OK     │ │
│  │  Census API       🟢 Yes     1,234ms   ✅     45 days ago  ✅ OK     │ │
│  │  BLS API          🟢 Yes     892ms     ✅     12 days ago  ✅ OK     │ │
│  │  GreatSchools     🟢 Yes     567ms     ⚠️     65 days ago  ✅ OK     │ │
│  │  WalkScore        🟢 Yes     432ms     ✅     30 days ago  ✅ OK     │ │
│  │  FBI Crime        🟢 Yes     1,890ms   ✅     120 days ago ✅ OK     │ │
│  │  EPA AQI          🟢 Yes     234ms     ✅     1 day ago    ✅ OK     │ │
│  │  FEMA Risk        🟢 Yes     678ms     ✅     90 days ago  ✅ OK     │ │
│  │                                                                        │ │
│  │  [ Refresh All ] [ Test Connection ] [ View History ]                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  PIPELINE RUNS (Last 24 Hours)                                              │
│                                                                             │
│  ┌─ Recent Runs ──────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Pipeline            Started      Duration  Records  Status            │ │
│  │  ─────────────────────────────────────────────────────────────────    │ │
│  │  zillow_zhvi         Today 6:00   4m 32s    33,120   ✅ Success       │ │
│  │  zillow_zori         Today 6:05   3m 18s    28,450   ✅ Success       │ │
│  │  zillow_market       Today 6:09   5m 44s    33,120   ✅ Success       │ │
│  │  bls_unemployment    Today 8:00   2m 12s    3,221    ✅ Success       │ │
│  │  epa_aqi             Today 12:00  45s       12,890   ⚠️ Partial       │ │
│  │                                                                        │ │
│  │  [ View All Runs ] [ Run Pipeline Manually ▼ ]                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Pipeline Details: epa_aqi (Partial) ──────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Status: ⚠️ Partial Success                                           │ │
│  │  Records Processed: 15,230                                             │ │
│  │  Records Loaded: 12,890                                                │ │
│  │  Records Rejected: 2,340 (15.4%)                                       │ │
│  │                                                                        │ │
│  │  Errors:                                                               │ │
│  │  • 2,340 records missing required 'aqi_value' field                   │ │
│  │  • Affected regions: AK (all), HI (partial)                           │ │
│  │                                                                        │ │
│  │  [ View Full Log ] [ Retry Failed Records ] [ Acknowledge ]            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ACTIVE ALERTS (2)                                                          │
│                                                                             │
│  ┌─ Alerts ───────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ⚠️ WARNING: GreatSchools data is stale (65 days)                     │ │
│  │     Expected: 90 days | Created: 2 hours ago                          │ │
│  │     [ Acknowledge ] [ Resolve ] [ Snooze ]                             │ │
│  │                                                                        │ │
│  │  ⚠️ WARNING: EPA AQI pipeline partial failure                         │ │
│  │     2,340 records rejected | Created: 4 hours ago                     │ │
│  │     [ Acknowledge ] [ Resolve ] [ View Details ]                       │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scheduled Health Checks (Cron)

```yaml
# .github/workflows/data-ingest-monitoring.yml
name: Data Ingest Monitoring

on:
  schedule:
    # Source health: Every hour
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  source-health:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run Source Health Checks
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          CENSUS_API_KEY: ${{ secrets.CENSUS_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: python -m ingest.monitoring.run_health_checks
      
      - name: Check Pipeline Health
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: python -m ingest.monitoring.check_pipelines
```

---

# Part 4: Notification Configuration

## 4.1 Alert Rules Configuration

```json
// config/alert_rules.json
{
  "rules": [
    {
      "name": "critical_source_unavailable",
      "condition_type": "availability",
      "condition_params": {},
      "severity": "critical",
      "notification_channels": ["slack", "pagerduty", "email"],
      "source_names": ["zillow_s3", "census_api", "bls_api"]
    },
    {
      "name": "source_stale_warning",
      "condition_type": "freshness",
      "condition_params": { "max_days": 45 },
      "severity": "warning",
      "notification_channels": ["slack"],
      "source_names": null  // All sources
    },
    {
      "name": "source_stale_critical",
      "condition_type": "freshness",
      "condition_params": { "max_days": 90 },
      "severity": "critical",
      "notification_channels": ["slack", "email"],
      "source_names": ["zillow_s3", "census_api"]
    },
    {
      "name": "schema_change_detected",
      "condition_type": "schema",
      "condition_params": {},
      "severity": "warning",
      "notification_channels": ["slack", "email"],
      "source_names": null
    },
    {
      "name": "pipeline_failure",
      "condition_type": "pipeline_status",
      "condition_params": { "status": "failed" },
      "severity": "critical",
      "notification_channels": ["slack", "pagerduty"],
      "pipeline_names": ["zillow_zhvi", "zillow_zori", "census_population"]
    },
    {
      "name": "pipeline_partial_failure",
      "condition_type": "pipeline_status",
      "condition_params": { "status": "partial", "reject_rate_threshold": 0.1 },
      "severity": "warning",
      "notification_channels": ["slack"],
      "pipeline_names": null
    },
    {
      "name": "data_card_unhealthy",
      "condition_type": "card_health",
      "condition_params": { "status": ["stale", "empty", "error"] },
      "severity": "warning",
      "notification_channels": ["slack"],
      "critical_cards_only": true
    }
  ]
}
```

## 4.2 Notification Service

```python
# ingest/monitoring/notifications.py

import aiohttp
import smtplib
from email.mime.text import MIMEText
from dataclasses import dataclass
from typing import Dict, Any
from enum import Enum

class NotificationChannel(Enum):
    SLACK = 'slack'
    EMAIL = 'email'
    PAGERDUTY = 'pagerduty'

@dataclass
class NotificationConfig:
    slack_webhook_url: str
    email_smtp_host: str
    email_smtp_port: int
    email_from: str
    email_to: list[str]
    pagerduty_routing_key: str

class NotificationService:
    
    def __init__(self, config: NotificationConfig):
        self.config = config
        
    async def send(
        self, 
        channel: str, 
        severity: str, 
        title: str, 
        message: str, 
        details: Dict[str, Any] = None
    ):
        """Send notification to specified channel."""
        
        if channel == 'slack':
            await self._send_slack(severity, title, message, details)
        elif channel == 'email':
            await self._send_email(severity, title, message, details)
        elif channel == 'pagerduty':
            await self._send_pagerduty(severity, title, message, details)
        else:
            raise ValueError(f"Unknown notification channel: {channel}")
    
    async def _send_slack(self, severity: str, title: str, message: str, details: Dict):
        """Send Slack notification."""
        
        color_map = {
            'critical': 'danger',
            'warning': 'warning',
            'info': 'good'
        }
        
        emoji_map = {
            'critical': '🔴',
            'warning': '⚠️',
            'info': 'ℹ️'
        }
        
        payload = {
            "attachments": [{
                "color": color_map.get(severity, 'warning'),
                "title": f"{emoji_map.get(severity, '')} {title}",
                "text": message,
                "fields": [
                    {"title": k, "value": str(v), "short": True}
                    for k, v in (details or {}).items()
                ][:10],  # Max 10 fields
                "footer": "PropertyIQ Data Monitoring",
                "ts": int(datetime.now().timestamp())
            }]
        }
        
        async with aiohttp.ClientSession() as session:
            await session.post(self.config.slack_webhook_url, json=payload)
    
    async def _send_email(self, severity: str, title: str, message: str, details: Dict):
        """Send email notification."""
        
        body = f"""
        {title}
        
        {message}
        
        Details:
        {chr(10).join(f'  {k}: {v}' for k, v in (details or {}).items())}
        
        ---
        PropertyIQ Data Monitoring
        """
        
        msg = MIMEText(body)
        msg['Subject'] = f"[{severity.upper()}] {title}"
        msg['From'] = self.config.email_from
        msg['To'] = ', '.join(self.config.email_to)
        
        with smtplib.SMTP(self.config.email_smtp_host, self.config.email_smtp_port) as server:
            server.send_message(msg)
    
    async def _send_pagerduty(self, severity: str, title: str, message: str, details: Dict):
        """Send PagerDuty alert (critical only)."""
        
        if severity != 'critical':
            return  # Only send critical alerts to PagerDuty
        
        payload = {
            "routing_key": self.config.pagerduty_routing_key,
            "event_action": "trigger",
            "payload": {
                "summary": title,
                "severity": "critical",
                "source": "PropertyIQ Data Monitoring",
                "custom_details": details or {}
            }
        }
        
        async with aiohttp.ClientSession() as session:
            await session.post(
                "https://events.pagerduty.com/v2/enqueue",
                json=payload
            )
```

---

# Part 5: Test File Structure

```
/tests
  /unit
    /scoring
      test_normalizers.py
      test_calculators.py
      test_missing_data.py
      test_confidence.py
    /data-cards
      DataCard.test.tsx
      MedianHomeValueCard.test.tsx
      # ... all 30 cards
    /ingest
      test_zillow_transform.py
      test_census_transform.py
      test_validation.py
  
  /integration
    /scoring
      test_score_pipeline.py
      test_inheritance.py
      test_backtest.py
    /data-cards
      DataCardIntegration.test.tsx
      DataCardAPI.test.tsx
    /ingest
      test_zillow_pipeline.py
      test_census_pipeline.py
      test_full_refresh.py
  
  /e2e
    /scoring
      score-display.spec.ts
      admin-dashboard.spec.ts
    /data-cards
      data-cards.spec.ts
      map-interaction.spec.ts
    /ingest
      manual-pipeline-run.spec.ts
  
  /fixtures
    /scoring
      golden_test_cases.json
      edge_cases.json
    /data-cards
      sample_metrics.json
    /ingest
      sample_zillow.csv
      sample_census.json
  
  /monitoring
    test_source_health.py
    test_pipeline_health.py
    test_alerts.py

  README.md
  conftest.py
  jest.config.js
  playwright.config.ts
```

---

# Part 6: Summary Checklist

## Scoring System Tests
- [ ] Unit tests for all normalization functions
- [ ] Unit tests for all component calculators
- [ ] Integration tests for full score pipeline
- [ ] E2E tests for user score viewing workflow
- [ ] Golden test cases with hand-calculated expected values
- [ ] Missing data scenario tests
- [ ] Backtest accuracy tests
- [ ] ML validation comparison tests

## Data Card Tests
- [ ] Unit tests for all 30 card components
- [ ] Integration tests for data loading
- [ ] E2E tests for user map interaction
- [ ] Health check endpoint
- [ ] Automated health monitoring (6-hourly)
- [ ] Slack alerts for card failures

## Data Ingest Tests
- [ ] Unit tests for all data transformations
- [ ] Integration tests for full pipelines
- [ ] Source availability checks
- [ ] Source freshness monitoring
- [ ] Schema change detection
- [ ] Pipeline failure alerts
- [ ] PagerDuty integration for critical failures

## Monitoring Infrastructure
- [ ] Health check endpoints for all systems
- [ ] Admin dashboard for monitoring
- [ ] Alert rules configuration
- [ ] Notification service (Slack, Email, PagerDuty)
- [ ] Scheduled health checks (GitHub Actions)
- [ ] Alert deduplication
- [ ] Alert acknowledgment/resolution workflow
