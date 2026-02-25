'use client';

/**
 * Implement Preview Dialog
 *
 * M3 dialog showing the AI-generated implementation plan:
 * - DB changes: table of operations with Apply button
 * - Code changes: code blocks with Copy button
 * - Manual actions: numbered steps with Mark Done button
 */

import { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Play,
  Loader2,
  Database,
  Code2,
  ListChecks,
} from 'lucide-react';
import type { ImplementationPlan } from '../hooks/useRecommendationExecutor';

interface ImplementPreviewProps {
  plan: ImplementationPlan;
  recTitle: string;
  onExecute: () => void;
  onClose: () => void;
  executing: boolean;
  executionResult?: { success: boolean; executed: string[]; errors: string[] } | null;
}

const RISK_STYLES = {
  low: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-700 dark:text-red-400',
} as const;

export function ImplementPreview({
  plan,
  recTitle,
  onExecute,
  onClose,
  executing,
  executionResult,
}: ImplementPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-2xl max-h-[85vh] rounded-[28px] shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h3 className="text-lg font-medium text-on-surface">
              Implementation Plan
            </h3>
            <p className="text-sm text-on-surface-variant mt-0.5 truncate max-w-md">
              {recTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Summary + Risk */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-on-surface">{plan.summary}</p>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${RISK_STYLES[plan.risk_level]}`}
            >
              {plan.risk_level} risk
            </span>
          </div>

          {/* DB Changes */}
          {plan.action_type === 'db_change' && plan.db_operations && (
            <DbChangesSection operations={plan.db_operations} />
          )}

          {/* Code Changes */}
          {plan.action_type === 'code_change' && plan.code_files && (
            <CodeChangesSection files={plan.code_files} />
          )}

          {/* Manual Steps */}
          {plan.action_type === 'manual' && plan.manual_steps && (
            <ManualStepsSection steps={plan.manual_steps} />
          )}

          {/* Execution Result */}
          {executionResult && (
            <ExecutionResultSection result={executionResult} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors"
          >
            {executionResult ? 'Close' : 'Cancel'}
          </button>
          {plan.action_type === 'db_change' && !executionResult && (
            <button
              onClick={onExecute}
              disabled={executing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Apply Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-sections ---

function DbChangesSection({
  operations,
}: {
  operations: NonNullable<ImplementationPlan['db_operations']>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium text-on-surface">
          Database Operations
        </h4>
      </div>
      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-on-surface-variant">
                Entity
              </th>
              <th className="text-left px-3 py-2 font-medium text-on-surface-variant">
                Field
              </th>
              <th className="text-left px-3 py-2 font-medium text-on-surface-variant">
                Current
              </th>
              <th className="text-left px-3 py-2 font-medium text-on-surface-variant">
                New Value
              </th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op, i) => (
              <tr key={i} className="border-t border-outline-variant/50">
                <td className="px-3 py-2 text-on-surface font-mono">
                  {op.tier_slug || op.entity}
                </td>
                <td className="px-3 py-2 text-on-surface font-mono">
                  {op.feature_slug || op.field}
                </td>
                <td className="px-3 py-2 text-on-surface-variant">
                  {JSON.stringify(op.current_value)}
                </td>
                <td className="px-3 py-2 text-primary font-medium">
                  {JSON.stringify(op.new_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        This will modify production feature flags. Review carefully.
      </p>
    </div>
  );
}

function CodeChangesSection({
  files,
}: {
  files: NonNullable<ImplementationPlan['code_files']>;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyCode = async (code: string, idx: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium text-on-surface">Code Changes</h4>
      </div>
      <div className="space-y-3">
        {files.map((file, i) => (
          <div
            key={i}
            className="border border-outline-variant rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-surface-container">
              <div>
                <span className="text-xs font-mono text-on-surface">
                  {file.file_path}
                </span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {file.description}
                </p>
              </div>
              <button
                onClick={() => copyCode(file.code, i)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-on-surface-variant hover:text-primary rounded transition-colors"
              >
                {copiedIdx === i ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="px-3 py-2 text-xs font-mono text-on-surface-variant overflow-x-auto max-h-48 bg-surface-container-low">
              {file.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualStepsSection({
  steps,
}: {
  steps: NonNullable<ImplementationPlan['manual_steps']>;
}) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set(),
  );

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium text-on-surface">Manual Steps</h4>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.step_number}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              completedSteps.has(step.step_number)
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-outline-variant/50 bg-surface'
            }`}
          >
            <button
              onClick={() => toggleStep(step.step_number)}
              className="mt-0.5 flex-shrink-0"
            >
              {completedSteps.has(step.step_number) ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-outline-variant" />
              )}
            </button>
            <div className="flex-1">
              <p
                className={`text-sm ${
                  completedSteps.has(step.step_number)
                    ? 'text-on-surface-variant line-through'
                    : 'text-on-surface'
                }`}
              >
                {step.description}
              </p>
              {step.effort_estimate && (
                <span className="text-xs text-on-surface-variant mt-1 inline-block">
                  Effort: {step.effort_estimate}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutionResultSection({
  result,
}: {
  result: { success: boolean; executed: string[]; errors: string[] };
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        result.success
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {result.success ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-600" />
        )}
        <h4 className="text-sm font-medium text-on-surface">
          {result.success ? 'Execution Complete' : 'Execution Failed'}
        </h4>
      </div>
      {result.executed.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
            Executed:
          </p>
          {result.executed.map((msg, i) => (
            <p key={i} className="text-xs text-on-surface-variant font-mono">
              {msg}
            </p>
          ))}
        </div>
      )}
      {result.errors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
            Errors:
          </p>
          {result.errors.map((msg, i) => (
            <p key={i} className="text-xs text-red-600 font-mono">
              {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
