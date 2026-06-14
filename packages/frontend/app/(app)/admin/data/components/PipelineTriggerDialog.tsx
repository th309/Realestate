/**
 * Pipeline Trigger Dialog
 *
 * M3 dialog that shows filter chips (metric type, geography level) when
 * manually triggering a pipeline. Allows subset selection before running.
 */

'use client';

import { useState, useCallback } from 'react';
import type { AvailablePipeline, PipelineFilterParams } from './pipelineRuns.types';

interface PipelineTriggerDialogProps {
  pipeline: AvailablePipeline;
  onClose: () => void;
  onTrigger: (pipelineName: string, filters: PipelineFilterParams) => void;
  triggering: boolean;
}

export function PipelineTriggerDialog({
  pipeline,
  onClose,
  onTrigger,
  triggering,
}: PipelineTriggerDialogProps) {
  const [selected, setSelected] = useState<PipelineFilterParams>({});

  const toggleOption = useCallback((dimensionKey: string, value: string) => {
    setSelected((prev) => {
      const current = prev[dimensionKey] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [dimensionKey]: exists
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }, []);

  const hasSelections = Object.values(selected).some((arr) => arr.length > 0);

  const handleRunSelected = () => {
    onTrigger(pipeline.name, selected);
  };

  const handleRunAll = () => {
    onTrigger(pipeline.name, {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-[28px] shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">
            Run {pipeline.label}
          </h2>
          <button
            onClick={onClose}
            disabled={triggering}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — filter dimensions */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-5">
          <p className="text-sm text-on-surface-variant">
            Select which subsets to import, or run all.
          </p>

          {pipeline.filters?.map((dimension) => (
            <div key={dimension.key}>
              <label className="block text-sm font-medium text-on-surface mb-2">
                {dimension.label}
              </label>
              <div className="flex flex-wrap gap-2">
                {dimension.options.map((opt) => {
                  const isSelected = (selected[dimension.key] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleOption(dimension.key, opt.value)}
                      disabled={triggering}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-secondary-container text-on-secondary-container border-secondary'
                          : 'bg-surface text-on-surface-variant border-outline hover:bg-surface-container'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={triggering}
            className="px-4 py-2 text-sm font-medium rounded-lg text-on-surface hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRunAll}
            disabled={triggering}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-primary text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
          >
            {triggering ? 'Triggering...' : 'Run All'}
          </button>
          <button
            onClick={handleRunSelected}
            disabled={triggering || !hasSelections}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {triggering ? 'Triggering...' : 'Run Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
