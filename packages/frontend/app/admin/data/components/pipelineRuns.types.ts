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

export interface AvailablePipeline {
  name: string;
  label: string;
}

export const AVAILABLE_PIPELINES: AvailablePipeline[] = [
  { name: 'zillow_zhvi', label: 'Zillow ZHVI' },
  { name: 'zillow_zori', label: 'Zillow ZORI' },
  { name: 'census_population', label: 'Census Population' },
  { name: 'bls_unemployment', label: 'BLS Unemployment' },
  { name: 'realtor_metrics', label: 'Realtor Metrics' },
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

export function getMockRuns(): PipelineRun[] {
  const now = new Date();
  return [
    {
      id: '1',
      pipelineName: 'zillow_zhvi',
      displayName: 'Zillow ZHVI',
      startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 33500,
      recordsInserted: 33120,
      recordsFailed: 0,
      durationMs: 272000,
    },
    {
      id: '2',
      pipelineName: 'zillow_zori',
      displayName: 'Zillow ZORI',
      startedAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 29000,
      recordsInserted: 28450,
      recordsFailed: 0,
      durationMs: 198000,
    },
    {
      id: '3',
      pipelineName: 'bls_unemployment',
      displayName: 'BLS Unemployment',
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 1.8 * 60 * 60 * 1000).toISOString(),
      status: 'success',
      recordsProcessed: 3250,
      recordsInserted: 3221,
      recordsFailed: 29,
      durationMs: 132000,
    },
    {
      id: '4',
      pipelineName: 'realtor_metrics',
      displayName: 'Realtor Metrics',
      startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 23.5 * 60 * 60 * 1000).toISOString(),
      status: 'failed',
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsFailed: 0,
      durationMs: 45000,
      errorMessage: 'Connection timeout to Realtor S3',
    },
    {
      id: '5',
      pipelineName: 'census_population',
      displayName: 'Census Population',
      startedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 600000).toISOString(),
      status: 'success',
      recordsProcessed: 33200,
      recordsInserted: 33000,
      recordsFailed: 200,
      durationMs: 600000,
    },
  ];
}
