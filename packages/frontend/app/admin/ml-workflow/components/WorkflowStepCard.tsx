/**
 * WorkflowStepCard Component
 *
 * Displays a single ML workflow step with status, outputs, and run controls.
 */

'use client';

import { useState, useEffect } from 'react';
import { WorkflowStep, StepStatus, OutputFile } from '../types';

interface WorkflowStepCardProps {
  step: WorkflowStep;
  stepNumber: number;
  status: StepStatus;
  lastRunTime: string | null;
  progress?: number;
  error?: string;
  outputFiles?: OutputFile[];
  onRun: () => void;
  onViewOutput?: (url: string) => void;
  disabled?: boolean;
  startedAt?: string | null;
}

const STATUS_CONFIG: Record<
  StepStatus,
  { bg: string; text: string; label: string; icon: string }
> = {
  pending: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Pending',
    icon: '○',
  },
  running: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'Running',
    icon: '◐',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Completed',
    icon: '●',
  },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error', icon: '●' },
};

const STEP_ICONS: Record<string, string> = {
  'data-export': '📦',
  'prepare-backtest-data': '🔧',
  'calculate-benchmarks': '📊',
  'feature-analysis': '🤖',
  'score-explanations': '💡',
  'monthly-report': '📈',
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Messages to show while running for each step
const RUNNING_MESSAGES: Record<string, string[]> = {
  'data-export': [
    'Fetching data from Supabase...',
    'Processing metro records...',
    'Processing county records...',
    'Processing zip records...',
    'Processing state records...',
    'Saving to Parquet cache...',
  ],
  'prepare-backtest-data': ['Analyzing cached data quality...'],
  'calculate-benchmarks': ['Computing national benchmarks...', 'Computing regional benchmarks...'],
  'feature-analysis': ['Running correlation analysis...'],
  'score-explanations': ['Generating statistical distributions...'],
  'monthly-report': ['Running backtests...', 'Generating validation report...'],
};

function formatElapsedTime(startTime: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function WorkflowStepCard({
  step,
  stepNumber,
  status,
  lastRunTime,
  progress,
  error,
  outputFiles,
  onRun,
  onViewOutput,
  disabled,
  startedAt,
}: WorkflowStepCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const icon = STEP_ICONS[step.id] || '📄';
  
  // Track elapsed time when running
  const [elapsedTime, setElapsedTime] = useState<string>('0s');
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    if (status !== 'running') {
      setElapsedTime('0s');
      setMessageIndex(0);
      return;
    }
    
    const startTime = startedAt ? new Date(startedAt) : new Date();
    
    // Update elapsed time every second
    const timer = setInterval(() => {
      setElapsedTime(formatElapsedTime(startTime));
    }, 1000);
    
    // Cycle through messages every 10 seconds
    const messages = RUNNING_MESSAGES[step.id] || ['Processing...'];
    const messageTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 10000);
    
    return () => {
      clearInterval(timer);
      clearInterval(messageTimer);
    };
  }, [status, startedAt, step.id]);

  const handleViewReport = (url: string) => {
    if (onViewOutput) {
      onViewOutput(url);
    } else {
      window.open(url, '_blank');
    }
  };
  
  const runningMessages = RUNNING_MESSAGES[step.id] || ['Processing...'];
  const currentMessage = runningMessages[messageIndex % runningMessages.length];

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className="font-medium text-on-surface">
                {stepNumber}. {step.name}
              </h3>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text} flex items-center gap-1`}
          >
            {status === 'running' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            ) : (
              <span>{statusConfig.icon}</span>
            )}
            {statusConfig.label}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1">{step.description}</p>
      </div>

      {/* Script Info */}
      <div className="px-4 py-2 bg-surface-container-low text-xs text-on-surface-variant">
        <div className="flex justify-between">
          <span>Script: {step.script}</span>
          <span>Est: {step.estimatedTime}</span>
        </div>
      </div>

      {/* Progress Bar (when running) */}
      {status === 'running' && (
        <div className="px-4 py-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
            <span className="flex items-center gap-1">
              <span className="animate-pulse">{currentMessage}</span>
            </span>
            <span className="font-mono">{elapsedTime}</span>
          </div>
          {/* Indeterminate progress bar */}
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-indeterminate-progress" />
          </div>
          {step.id === 'data-export' && (
            <p className="text-xs text-on-surface-variant/70 mt-1 italic">
              First run fetches 3.6M+ records. This may take 5-15 minutes.
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && error && (
        <div className="px-4 py-2 bg-error-container">
          <p className="text-xs text-on-error-container">{error}</p>
        </div>
      )}

      {/* Status & Outputs */}
      <div className="p-4 flex-1">
        <div className="text-xs text-on-surface-variant mb-2">
          Last run: {formatRelativeTime(lastRunTime)}
        </div>

        {/* Output Files or Expected Outputs */}
        {outputFiles && outputFiles.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-on-surface-variant font-medium">
              Outputs:
            </div>
            {outputFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-on-surface-variant flex items-center gap-1">
                  <span>📄</span>
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  <span className="text-on-surface-variant/60">({file.size})</span>
                </span>
                {file.viewUrl && (
                  <button
                    onClick={() => handleViewReport(file.viewUrl!)}
                    className="text-primary hover:text-primary/80 font-medium"
                  >
                    View
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : step.outputs && step.outputs.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-on-surface-variant font-medium">
              Outputs:
            </div>
            {step.outputs.map((output, idx) => (
              <div key={idx} className="text-xs text-on-surface-variant/70 flex items-center gap-1">
                <span className="text-on-surface-variant/50">•</span>
                <span>{output}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-on-surface-variant">Outputs: --</div>
        )}
      </div>

      {/* Run Button */}
      <div className="p-4 pt-0">
        <button
          onClick={onRun}
          disabled={disabled || status === 'running'}
          className={`
            w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${
              status === 'running'
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                : disabled
                  ? 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary/90'
            }
          `}
        >
          {status === 'running' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-on-surface-variant/30 border-t-on-surface-variant rounded-full animate-spin" />
              Running...
            </span>
          ) : (
            'Run Step'
          )}
        </button>
      </div>
    </div>
  );
}
