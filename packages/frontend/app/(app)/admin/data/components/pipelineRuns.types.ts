/**
 * Pipeline Runs Types and Utilities
 *
 * Shared types, helpers, and mock data for pipeline run components.
 */

export interface PipelineRun {
  id: string;
  pipelineName: string;
  displayName: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  durationMs: number | null;
  errorMessage?: string;
}

export interface PipelineFilterOption {
  value: string;
  label: string;
}

export interface PipelineFilterDimension {
  key: string;
  label: string;
  options: PipelineFilterOption[];
  multiple: boolean;
}

export interface PipelineFilterParams {
  [key: string]: string[];
}

export interface AvailablePipeline {
  name: string;
  label: string;
  filters?: PipelineFilterDimension[];
}

const ZILLOW_METRIC_OPTIONS: PipelineFilterOption[] = [
  { value: 'zhvi', label: 'ZHVI (Home Value)' },
  { value: 'zori', label: 'ZORI (Rent)' },
  { value: 'market_heat', label: 'Market Heat Index' },
  { value: 'days_on_market', label: 'Days on Market' },
  { value: 'new_listings', label: 'New Listings' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'price_cuts', label: 'Price Cuts' },
  { value: 'sale_to_list', label: 'Sale-to-List Ratio' },
  { value: 'sold_above_list', label: 'Sold Above List' },
  { value: 'median_sale_price', label: 'Median Sale Price' },
  { value: 'sales_count', label: 'Sales Count' },
];

const STANDARD_GEO_OPTIONS: PipelineFilterOption[] = [
  { value: 'state', label: 'State' },
  { value: 'metro', label: 'Metro' },
  { value: 'county', label: 'County' },
  { value: 'zip', label: 'ZIP' },
];

export const AVAILABLE_PIPELINES: AvailablePipeline[] = [
  {
    name: 'zillow',
    label: 'Zillow',
    filters: [
      { key: 'metric', label: 'Metric Type', options: ZILLOW_METRIC_OPTIONS, multiple: true },
      { key: 'geography', label: 'Geography', options: STANDARD_GEO_OPTIONS, multiple: true },
    ],
  },
  {
    name: 'realtor',
    label: 'Realtor',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'national', label: 'National' },
          { value: 'state', label: 'State' },
          { value: 'metro', label: 'Metro' },
          { value: 'county', label: 'County' },
          { value: 'zip', label: 'ZIP' },
        ],
        multiple: true,
      },
    ],
  },
  {
    name: 'census_acs',
    label: 'Census ACS',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'national', label: 'National' },
          { value: 'state', label: 'State' },
          { value: 'metro', label: 'Metro' },
          { value: 'county', label: 'County' },
          { value: 'city', label: 'City' },
          { value: 'zip', label: 'ZIP' },
        ],
        multiple: true,
      },
    ],
  },
  {
    name: 'bls',
    label: 'BLS',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'national', label: 'National' },
          { value: 'state', label: 'State' },
          { value: 'metro', label: 'Metro' },
          { value: 'county', label: 'County' },
        ],
        multiple: true,
      },
    ],
  },
  {
    name: 'fred',
    label: 'FRED',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'national', label: 'National' },
          { value: 'state', label: 'State' },
        ],
        multiple: true,
      },
    ],
  },
  { name: 'hud_fmr', label: 'HUD FMR' },
  {
    name: 'building_permits',
    label: 'Building Permits',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'state', label: 'State' },
          { value: 'county', label: 'County' },
        ],
        multiple: true,
      },
    ],
  },
  {
    name: 'redfin',
    label: 'Redfin',
    filters: [
      {
        key: 'geography',
        label: 'Geography',
        options: [
          { value: 'national', label: 'National' },
          { value: 'state', label: 'State' },
          { value: 'metro', label: 'Metro' },
          { value: 'county', label: 'County' },
          { value: 'city', label: 'City' },
          { value: 'zip', label: 'ZIP' },
          { value: 'neighborhood', label: 'Neighborhood' },
        ],
        multiple: true,
      },
    ],
  },
];

export function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'partial':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'partial':
      return 'Partial';
    default:
      return status;
  }
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return 'In progress...';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function formatRunDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`;
}

// No mock data - all data comes from the API at /api/health/pipeline-runs
